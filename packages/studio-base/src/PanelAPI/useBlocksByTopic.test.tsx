/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { renderHook } from "@testing-library/react-hooks";
import { cloneDeep } from "lodash";

import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";

import * as PanelAPI from ".";

describe("useBlocksByTopic", () => {
  it("returns an empty structure when there are no blocks", async () => {
    const { result } = renderHook(({ topics }) => PanelAPI.useBlocksByTopic(topics), {
      initialProps: { topics: ["/foo"] },
      wrapper: ({ children }) => (
        <MockMessagePipelineProvider>{children}</MockMessagePipelineProvider>
      ),
    });

    expect(result.current).toEqual([]);
  });

  it("returns no messagesByTopic when the player does not provide blocks", async () => {
    const { result } = renderHook(({ topics }) => PanelAPI.useBlocksByTopic(topics), {
      initialProps: { topics: ["/topic1"] },
      wrapper: ({ children }) => (
        <MockMessagePipelineProvider activeData={{}}>{children}</MockMessagePipelineProvider>
      ),
    });

    // Consumers just need to check in one place to see whether they need a fallback for a topic:
    // in messageReadersByTopic. (They don't also need to check the presence of blocks.)
    expect(result.current).toEqual([]);
  });

  it("handles uninitialized block states", async () => {
    // messagesByTopic will not exist.
    const activeData = undefined;
    // Note: progress.blocks.map() does not iterate over the blocks.
    const progress = {
      messageCache: {
        blocks: new Array(2),
        startTime: { sec: 0, nsec: 0 },
      },
    };
    const { result } = renderHook(({ topics }) => PanelAPI.useBlocksByTopic(topics), {
      initialProps: { topics: ["/topic1"] },
      wrapper: ({ children }) => (
        <MockMessagePipelineProvider activeData={activeData} progress={progress}>
          {children}
        </MockMessagePipelineProvider>
      ),
    });

    // No message readers, even though we have a definition and we try to subscribe to the topic.
    // This means the data will never be provided.
    expect(result.current).toEqual([undefined, undefined]);
  });

  it("maintains block identity across repeated renders", async () => {
    const activeData = {};
    let progress = {
      messageCache: {
        blocks: [{ sizeInBytes: 0, messagesByTopic: { "/topic": [] } }],
        startTime: { sec: 0, nsec: 0 },
      },
    };
    const { result, rerender } = renderHook(({ topics }) => PanelAPI.useBlocksByTopic(topics), {
      initialProps: { topics: ["/topic"] },
      wrapper: ({ children }) => (
        <MockMessagePipelineProvider activeData={activeData} progress={progress}>
          {children}
        </MockMessagePipelineProvider>
      ),
    });

    const c1 = result.current;
    expect(result.current).toEqual([{ "/topic": [] }]);

    // Same identity on everything. useBlocksByTopic does not run again.
    progress = { messageCache: { ...progress.messageCache } };
    rerender({ topics: ["/topic"] });
    expect(result.current).toBe(c1);

    // Block identity is the same, but blocks array identity changes.
    progress = {
      messageCache: { ...progress.messageCache, blocks: progress.messageCache.blocks.slice() },
    };
    rerender({ topics: ["/topic"] });
    const c3 = result.current;

    // Both identities change.
    progress = { messageCache: cloneDeep(progress.messageCache) };
    rerender({ topics: ["/topic"] });
    const c4 = result.current;

    expect(c1).not.toBe(c3);
    expect(c1[0]).toBe(c3[0]);

    expect(c3).not.toBe(c4);
    expect(c3[0]).not.toBe(c4[0]);
  });
});
