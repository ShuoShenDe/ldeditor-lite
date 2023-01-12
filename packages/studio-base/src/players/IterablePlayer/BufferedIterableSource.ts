// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Condvar } from "@foxglove/den/async";
import { VecQueue } from "@foxglove/den/collection";
import Log from "@foxglove/log";
import { add as addTime, compare, clampTime } from "@foxglove/rostime";
import { Time, MessageEvent } from "@foxglove/studio";
import { Range } from "@foxglove/studio-base/util/ranges";

import { CachingIterableSource } from "./CachingIterableSource";
import {
  GetBackfillMessagesArgs,
  IIterableSource,
  Initalization,
  IteratorResult,
  MessageIteratorArgs,
} from "./IIterableSource";

const log = Log.getLogger(__filename);

const DEFAULT_READ_AHEAD_DURATION = { sec: 10, nsec: 0 };

type Options = {
  // How far ahead to buffer
  readAheadDuration?: Time;
};

/**
 * BufferedIterableSource proxies access to IIterableSource. It buffers the messageIterator by
 * reading ahead in the underlying source.
 *
 * The architecture of BufferedIterableSource follows a producer-consumer model. The messageIterator
 * is the consumer and reads messages from cache while the startProducer method produces messages by
 * reading from the underlying source and populating the cache.
 */
class BufferedIterableSource implements IIterableSource {
  private source: CachingIterableSource;

  private readDone = false;
  private aborted = false;

  // The producer uses this signal to notify a waiting consumer there is data to consume.
  private readSignal = new Condvar();

  // The consumer uses this signal to notify a waiting producer that something has been consumed.
  private writeSignal = new Condvar();

  // The producer loads results into the cache and the consumer reads from the cache.
  private cache = new VecQueue<IteratorResult>();

  // The location of the consumer read head
  private readHead: Time = { sec: 0, nsec: 0 };

  // The promise for the current producer. The message generator starts a producer and awaits the
  // producer before exiting.
  private producer?: Promise<void>;

  private initResult?: Initalization;

  // How far ahead of the read head we should try to keep buffering
  private readAheadDuration: Time;

  public constructor(source: IIterableSource, opt?: Options) {
    this.readAheadDuration = opt?.readAheadDuration ?? DEFAULT_READ_AHEAD_DURATION;
    this.source = new CachingIterableSource(source);
  }

  public async initialize(): Promise<Initalization> {
    this.initResult = await this.source.initialize();
    return this.initResult;
  }

  private async startProducer(args: MessageIteratorArgs): Promise<void> {
    if (!this.initResult) {
      throw new Error("Invariant: uninitialized");
    }

    if (args.topics.length === 0) {
      this.readDone = true;
      return;
    }

    log.debug("Starting producer");

    // Clear the cache and start producing into an empty array, the consumer removes elements from
    // the start of the array.
    this.cache.clear();

    try {
      const sourceIterator = this.source.messageIterator({
        topics: args.topics,
        start: this.readHead,
        consumptionType: "partial",
      });

      // Messages are read from the source until reaching the readUntil time. Then we wait for the read head
      // to move forward and adjust readUntil
      let readUntil = clampTime(
        addTime(this.readHead, this.readAheadDuration),
        this.initResult.start,
        this.initResult.end,
      );

      for await (const result of sourceIterator) {
        if (this.aborted) {
          return;
        }

        // Update the target readUntil to be ahead of the latest readHead
        //
        // Since reading a result from the iterator is async, we update the readUntil after we have
        // the result so we can have the latest readHead
        readUntil = addTime(this.readHead, this.readAheadDuration);

        // When receiving a stamp result we enqueue the result into the cache and notify a reader.
        if (result.type === "stamp" && compare(result.stamp, readUntil) >= 0) {
          while (compare(result.stamp, readUntil) >= 0) {
            // enqueue the stamp and wakeup the reader
            // but the reader might not be reading - cause it is not being read from
            this.cache.enqueue(result);
            this.readSignal.notifyAll();

            await this.writeSignal.wait();
            readUntil = addTime(this.readHead, this.readAheadDuration);
          }
          continue;
        }

        this.cache.enqueue(result);

        // Indicate to the consumer that it can try reading again
        this.readSignal.notifyAll();

        // Keep reading while the messages we receive are <= the readUntil time.
        if (
          result.type === "message-event" &&
          compare(result.msgEvent.receiveTime, readUntil) <= 0
        ) {
          continue;
        }

        // If we didn't load anything into the cache keep reading
        if (this.cache.size() === 0) {
          continue;
        }

        // Wait for consumer thread to read something before trying to load more data
        await this.writeSignal.wait();
      }
    } finally {
      // Indicate to the consumer that it can try reading again
      this.readSignal.notifyAll();
      this.readDone = true;
    }

    log.debug("producer done");
  }

  public async terminate(): Promise<void> {
    this.cache.clear();
    await this.source.terminate();
  }

  public async stopProducer(): Promise<void> {
    this.aborted = true;
    this.writeSignal.notifyAll();
    await this.producer;
    this.producer = undefined;
  }

  public loadedRanges(): Range[] {
    return this.source.loadedRanges();
  }

  public messageIterator(
    args: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult>> {
    if (!this.initResult) {
      throw new Error("Invariant: uninitialized");
    }

    if (this.producer) {
      throw new Error("Invariant: BufferedIterableSource allows only one messageIterator");
    }

    const start = args.start ?? this.initResult.start;

    // Setup the initial cacheUntilTime to start buffing data
    this.readHead = start;

    this.aborted = false;
    this.readDone = false;

    // Create and start the producer when the messageIterator function is called.
    this.producer = this.startProducer(args);

    // Rather than messageIterator itself being a generator, we return a generator function. This is
    // so the setup code above will run when the messageIterator is called rather than when .next()
    // is called the first time. This behavior is important because we want the producer to start
    // producing immediately.
    //
    // Alias `this` to `self` for use in the generator function because we can't make fat-arrow
    // generator functions
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    return (async function* bufferedIterableGenerator() {
      try {
        if (args.topics.length === 0) {
          return;
        }

        for (;;) {
          const item = self.cache.dequeue();
          if (!item) {
            if (self.readDone) {
              break;
            }

            // Wait for more stuff to load
            await self.readSignal.wait();
            continue;
          }

          if (item.type === "stamp") {
            self.readHead = item.stamp;
          }

          // When there is a new message update the readHead for the producer to know where we are
          // currently reading
          if (item.type === "message-event") {
            self.readHead = item.msgEvent.receiveTime;
          }

          // Notify the producer thread that it can load more data. Since our producer and consumer are on the same _thread_
          // this notification is picked up on the next tick.
          self.writeSignal.notifyAll();

          yield item;
        }
      } finally {
        log.debug("ending buffered message iterator");
        await self.stopProducer();
      }
    })();
  }

  public async getBackfillMessages(
    args: GetBackfillMessagesArgs,
  ): Promise<MessageEvent<unknown>[]> {
    return await this.source.getBackfillMessages(args);
  }
}

export { BufferedIterableSource };
