// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { omit } from "lodash";
import { useEffect, useRef, useState } from "react";
import shallowequal from "shallowequal";
import { createStore } from "zustand";

import { Time, isLessThan } from "@foxglove/rostime";
import { ParameterValue } from "@foxglove/studio";
import {
  AdvertiseOptions,
  MessageEvent,
  PlayerPresence,
  PlayerStateActiveData,
  PlayerProblem,
  Progress,
  PublishPayload,
  SubscribePayload,
  Topic,
  PlayerURLState,
  TopicStats,
} from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

import { ContextInternal } from "./index";
import { MessagePipelineInternalState, MessagePipelineStateAction, reducer } from "./store";

const NO_DATATYPES = new Map();

function noop() {}

type MockMessagePipelineProps = {
  presence?: PlayerPresence;
  topics?: Topic[];
  topicStats?: Map<string, TopicStats>;
  datatypes?: RosDatatypes;
  messages?: MessageEvent<unknown>[];
  problems?: PlayerProblem[];
  publish?: (request: PublishPayload) => void;
  callService?: (service: string, request: unknown) => Promise<unknown>;
  setPublishers?: (arg0: string, arg1: AdvertiseOptions[]) => void;
  setSubscriptions?: (arg0: string, arg1: SubscribePayload[]) => void;
  setParameter?: (key: string, value: ParameterValue) => void;
  noActiveData?: boolean;
  activeData?: Partial<PlayerStateActiveData>;
  capabilities?: string[];
  profile?: string;
  startPlayback?: () => void;
  pausePlayback?: () => void;
  seekPlayback?: (arg0: Time) => void;
  currentTime?: Time;
  startTime?: Time;
  endTime?: Time;
  isPlaying?: boolean;
  pauseFrame?: (arg0: string) => () => void;
  playerId?: string;
  progress?: Progress;
  urlState?: PlayerURLState;
  /* eslint-enable react/no-unused-prop-types */
};
type MockMessagePipelineState = MessagePipelineInternalState & {
  mockProps: MockMessagePipelineProps;
  dispatch: (
    action:
      | MessagePipelineStateAction
      | { type: "set-mock-props"; mockProps: MockMessagePipelineProps },
  ) => void;
};

function getPublicState(
  prevState: MockMessagePipelineState | undefined,
  props: MockMessagePipelineProps,
  dispatch: MockMessagePipelineState["dispatch"],
): Omit<MessagePipelineInternalState["public"], "messageEventsBySubscriberId"> {
  let startTime = prevState?.public.playerState.activeData?.startTime;
  let currentTime = props.currentTime;
  if (!currentTime) {
    for (const message of props.messages ?? []) {
      if (startTime == undefined || isLessThan(message.receiveTime, startTime)) {
        startTime = message.receiveTime;
      }
      if (!currentTime || isLessThan(currentTime, message.receiveTime)) {
        currentTime = message.receiveTime;
      }
    }
  }

  return {
    playerState: {
      presence: props.presence ?? PlayerPresence.PRESENT,
      playerId: props.playerId ?? "1",
      progress: props.progress ?? {},
      capabilities: props.capabilities ?? prevState?.public.playerState.capabilities ?? [],
      profile: props.profile,
      problems: props.problems,
      urlState: props.urlState,
      activeData:
        props.noActiveData === true
          ? undefined
          : {
              messages: props.messages ?? [],
              topics: props.topics ?? [],
              topicStats: props.topicStats ?? new Map(),
              datatypes: props.datatypes ?? NO_DATATYPES,
              startTime: props.startTime ?? startTime ?? { sec: 100, nsec: 0 },
              currentTime: currentTime ?? { sec: 100, nsec: 0 },
              endTime: props.endTime ?? currentTime ?? { sec: 100, nsec: 0 },
              isPlaying: props.isPlaying ?? false,
              speed: 0.2,
              lastSeekTime: 0,
              totalBytesReceived: 0,
              ...props.activeData,
            },
    },
    subscriptions: [],
    publishers: [],
    sortedTopics:
      props.topics === prevState?.mockProps.topics
        ? prevState?.public.sortedTopics ?? []
        : props.topics
        ? [...props.topics].sort((a, b) => a.name.localeCompare(b.name))
        : [],
    datatypes: props.datatypes ?? NO_DATATYPES,
    setSubscriptions:
      (props.setSubscriptions === prevState?.mockProps.setSubscriptions
        ? prevState?.public.setSubscriptions
        : undefined) ??
      ((id, payloads) => {
        dispatch({ type: "update-subscriber", id, payloads });
        props.setSubscriptions?.(id, payloads);
      }),
    setPublishers:
      (props.setPublishers === prevState?.mockProps.setPublishers
        ? prevState?.public.setPublishers
        : undefined) ??
      ((id, payloads) => {
        dispatch({ type: "set-publishers", id, payloads });
        props.setPublishers?.(id, payloads);
      }),
    setParameter: props.setParameter ?? noop,
    publish: props.publish ?? noop,
    callService: props.callService ?? (async () => {}),
    startPlayback: props.startPlayback,
    playUntil: noop,
    pausePlayback: props.pausePlayback,
    setPlaybackSpeed: noop,
    seekPlayback: props.seekPlayback,

    pauseFrame: props.pauseFrame ?? (() => noop),
  };
}

export default function MockMessagePipelineProvider(
  props: React.PropsWithChildren<MockMessagePipelineProps>,
): React.ReactElement {
  const startTime = useRef<Time | undefined>();
  let currentTime = props.currentTime;
  if (!currentTime) {
    for (const message of props.messages ?? []) {
      if (startTime.current == undefined || isLessThan(message.receiveTime, startTime.current)) {
        startTime.current = message.receiveTime;
      }
      if (!currentTime || isLessThan(currentTime, message.receiveTime)) {
        currentTime = message.receiveTime;
      }
    }
  }

  const [store] = useState(() =>
    createStore<MockMessagePipelineState>((set) => {
      const dispatch: MockMessagePipelineState["dispatch"] = (action) => {
        if (action.type === "set-mock-props") {
          set((state) => {
            if (shallowequal(state.mockProps, action.mockProps)) {
              return state;
            }
            const publicState = getPublicState(state, action.mockProps, state.dispatch);
            const newState = reducer(state, {
              type: "update-player-state",
              playerState: publicState.playerState,
            });
            return {
              ...newState,
              mockProps: action.mockProps,
              dispatch: state.dispatch,
              public: {
                ...publicState,
                messageEventsBySubscriberId: newState.public.messageEventsBySubscriberId,
              },
            };
          });
        } else {
          set((state) => {
            // In the real pipeline, the messageEventsBySubscriberId only change
            // on player listener callback - not on subscriber changes
            //
            // In tests, the first setSubscriptions call happens after we've already set props.messages
            // So we have some special logic to detect the change of subscriptions
            // and update messageEventsBySubscriberId.
            const newState = reducer(state, action);
            const messages = newState.public.playerState.activeData?.messages;
            if (action.type === "update-subscriber" && messages && messages.length !== 0) {
              let changed = false;
              const messageEventsBySubscriberId = new Map<string, MessageEvent<unknown>[]>();
              for (const [id, subs] of newState.subscriptionsById) {
                const existingMsgs = newState.public.messageEventsBySubscriberId.get(id);
                const newMsgs = messages.filter(
                  (msg) => subs.find((sub) => sub.topic === msg.topic) != undefined,
                );
                if (existingMsgs && shallowequal(existingMsgs, newMsgs)) {
                  messageEventsBySubscriberId.set(id, existingMsgs);
                } else {
                  messageEventsBySubscriberId.set(id, newMsgs);
                  changed = true;
                  continue;
                }
              }

              if (changed) {
                newState.public.messageEventsBySubscriberId = messageEventsBySubscriberId;
              }
              return { ...newState, dispatch: state.dispatch };
            }
            return { ...newState, dispatch: state.dispatch };
          });
        }
      };
      const initialPublicState = getPublicState(undefined, props, dispatch);
      return {
        mockProps: omit(props, "children"),
        player: undefined,
        dispatch,
        publishersById: {},
        subscriptionsById: new Map(),
        subscriberIdsByTopic: new Map(),
        newTopicsBySubscriberId: new Map(),
        lastMessageEventByTopic: new Map(),
        lastCapabilities: initialPublicState.playerState.capabilities,
        public: {
          ...initialPublicState,
          messageEventsBySubscriberId: new Map(),
        },
      };
    }),
  );

  useEffect(() => {
    store.getState().dispatch({ type: "set-mock-props", mockProps: omit(props, "children") });
  }, [props, store]);

  return <ContextInternal.Provider value={store}>{props.children}</ContextInternal.Provider>;
}
