/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { act, renderHook } from "@testing-library/react-hooks";
import { SnackbarProvider } from "notistack";
import { useEffect } from "react";

import { Condvar } from "@foxglove/den/async";
import {
  CurrentLayoutActions,
  LayoutState,
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { LayoutData } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import LayoutManagerContext from "@foxglove/studio-base/context/LayoutManagerContext";
import {
  UserProfileStorage,
  UserProfileStorageContext,
} from "@foxglove/studio-base/context/UserProfileStorageContext";
import CurrentLayoutProvider from "@foxglove/studio-base/providers/CurrentLayoutProvider";
import { ILayoutManager } from "@foxglove/studio-base/services/ILayoutManager";
import { LayoutID } from "@foxglove/studio-base/services/ILayoutStorage";

const TEST_LAYOUT: LayoutData = {
  layout: "ExamplePanel!1",
  configById: {},
  globalVariables: {},
  userNodes: {},
  playbackConfig: {
    speed: 0.2,
  },
};

function mockThrow(name: string) {
  return () => {
    throw new Error(`Unexpected mock function call ${name}`);
  };
}

function makeMockLayoutManager() {
  return {
    supportsSharing: false,
    supportsSyncing: false,
    isBusy: false,
    isOnline: false,
    error: undefined,
    on: jest.fn(/*noop*/),
    off: jest.fn(/*noop*/),
    setError: jest.fn(/*noop*/),
    setOnline: jest.fn(/*noop*/),
    getLayouts: jest.fn().mockImplementation(mockThrow("getLayouts")),
    getLayout: jest.fn().mockImplementation(mockThrow("getLayout")),
    saveNewLayout: jest.fn().mockImplementation(mockThrow("saveNewLayout")),
    updateLayout: jest.fn().mockImplementation(mockThrow("updateLayout")),
    deleteLayout: jest.fn().mockImplementation(mockThrow("deleteLayout")),
    overwriteLayout: jest.fn().mockImplementation(mockThrow("overwriteLayout")),
    revertLayout: jest.fn().mockImplementation(mockThrow("revertLayout")),
    makePersonalCopy: jest.fn().mockImplementation(mockThrow("makePersonalCopy")),
  };
}
function makeMockUserProfile() {
  return {
    getUserProfile: jest.fn().mockImplementation(mockThrow("getUserProfile")),
    setUserProfile: jest.fn().mockImplementation(mockThrow("setUserProfile")),
  };
}

function renderTest({
  mockLayoutManager,
  mockUserProfile,
}: {
  mockLayoutManager: ILayoutManager;
  mockUserProfile: UserProfileStorage;
}) {
  const childMounted = new Condvar();
  const childMountedWait = childMounted.wait();
  const all: Array<{
    actions: CurrentLayoutActions;
    layoutState: LayoutState;
    childMounted: Promise<void>;
  }> = [];
  const { result } = renderHook(
    () => {
      const value = {
        actions: useCurrentLayoutActions(),
        layoutState: useCurrentLayoutSelector((state) => state),
        childMounted: childMountedWait,
      };
      all.push(value);
      return value;
    },
    {
      wrapper: function Wrapper({ children }) {
        useEffect(() => childMounted.notifyAll(), []);
        return (
          <SnackbarProvider>
            <LayoutManagerContext.Provider value={mockLayoutManager}>
              <UserProfileStorageContext.Provider value={mockUserProfile}>
                <CurrentLayoutProvider>{children}</CurrentLayoutProvider>
              </UserProfileStorageContext.Provider>
            </LayoutManagerContext.Provider>
          </SnackbarProvider>
        );
      },
    },
  );
  return { result, all };
}

describe("CurrentLayoutProvider", () => {
  it("uses currentLayoutId from UserProfile to load from LayoutStorage", async () => {
    const expectedState: LayoutData = {
      layout: "Foo!bar",
      configById: { "Foo!bar": { setting: 1 } },
      globalVariables: { var: "hello" },
      userNodes: { node1: { name: "node", sourceCode: "node()" } },
      playbackConfig: { speed: 0.1 },
    };
    const condvar = new Condvar();
    const layoutStorageGetCalledWait = condvar.wait();
    const mockLayoutManager = makeMockLayoutManager();
    mockLayoutManager.getLayout.mockImplementation(async () => {
      condvar.notifyAll();
      return {
        id: "example",
        name: "Example layout",
        baseline: { updatedAt: new Date(10).toISOString(), data: expectedState },
      };
    });

    const mockUserProfile = makeMockUserProfile();
    mockUserProfile.getUserProfile.mockResolvedValue({ currentLayoutId: "example" });

    const { all } = renderTest({ mockLayoutManager, mockUserProfile });
    await act(async () => await layoutStorageGetCalledWait);

    expect(mockLayoutManager.getLayout.mock.calls).toEqual([["example"], ["example"]]);
    expect(all.map((item) => (item instanceof Error ? undefined : item.layoutState))).toEqual([
      { selectedLayout: undefined },
      { selectedLayout: { loading: true, id: "example", data: undefined } },
      { selectedLayout: { loading: false, id: "example", data: expectedState } },
    ]);
    (console.warn as jest.Mock).mockClear();
  });

  it("saves new layout selection into UserProfile", async () => {
    const mockLayoutManager = makeMockLayoutManager();
    const newLayout: Partial<LayoutData> = {
      ...TEST_LAYOUT,
      layout: "ExamplePanel!2",
    };
    mockLayoutManager.getLayout.mockImplementation(async (id: string) => {
      return id === "example"
        ? {
            id: "example",
            name: "Example layout",
            baseline: { data: TEST_LAYOUT, updatedAt: new Date(10).toISOString() },
          }
        : {
            id: "example2",
            name: "Example layout 2",
            baseline: { data: newLayout, updatedAt: new Date(12).toISOString() },
          };
    });

    const condvar = new Condvar();
    const userProfileSetCalled = condvar.wait();
    const mockUserProfile = makeMockUserProfile();
    mockUserProfile.getUserProfile.mockResolvedValue({ currentLayoutId: "example" });
    mockUserProfile.setUserProfile.mockImplementation(async () => {
      condvar.notifyAll();
    });

    const { result, all } = renderTest({
      mockLayoutManager,
      mockUserProfile,
    });

    await act(async () => await result.current.childMounted);
    await act(async () => result.current.actions.setSelectedLayoutId("example2" as LayoutID));
    await act(async () => await userProfileSetCalled);

    expect(mockUserProfile.setUserProfile.mock.calls).toEqual([[{ currentLayoutId: "example2" }]]);
    expect(all.map((item) => (item instanceof Error ? undefined : item.layoutState))).toEqual([
      { selectedLayout: undefined },
      { selectedLayout: { loading: true, id: "example", data: undefined } },
      { selectedLayout: { loading: false, id: "example", data: TEST_LAYOUT } },
      { selectedLayout: { loading: true, id: "example2", data: undefined } },
      { selectedLayout: { loading: false, id: "example2", data: newLayout } },
    ]);
    (console.warn as jest.Mock).mockClear();
  });

  it("saves layout updates into LayoutStorage", async () => {
    const condvar = new Condvar();
    const layoutStoragePutCalled = condvar.wait();
    const mockLayoutManager = makeMockLayoutManager();
    mockLayoutManager.getLayout.mockImplementation(async () => {
      return {
        id: "example",
        name: "Test layout",
        baseline: { data: TEST_LAYOUT, updatedAt: new Date(10).toISOString() },
      };
    });

    mockLayoutManager.updateLayout.mockImplementation(async () => condvar.notifyAll());
    const mockUserProfile = makeMockUserProfile();
    mockUserProfile.getUserProfile.mockResolvedValue({ currentLayoutId: "example" });

    const { result, all } = renderTest({
      mockLayoutManager,
      mockUserProfile,
    });

    await act(async () => await result.current.childMounted);
    act(() => result.current.actions.setPlaybackConfig({ speed: 10 }));
    await act(async () => await layoutStoragePutCalled);

    const newState = {
      ...TEST_LAYOUT,
      playbackConfig: {
        ...TEST_LAYOUT.playbackConfig,
        speed: 10,
      },
    };

    expect(mockLayoutManager.updateLayout.mock.calls).toEqual([
      [{ id: "example", data: newState }],
    ]);
    expect(all.map((item) => (item instanceof Error ? undefined : item.layoutState))).toEqual([
      { selectedLayout: undefined },
      { selectedLayout: { loading: true, id: "example", data: undefined } },
      { selectedLayout: { loading: false, id: "example", data: TEST_LAYOUT } },
      { selectedLayout: { loading: false, id: "example", data: newState } },
    ]);
    (console.warn as jest.Mock).mockClear();
  });

  it("keeps identity of action functions when modifying layout", async () => {
    const condvar = new Condvar();
    const layoutStoragePutCalled = condvar.wait();
    const mockLayoutManager = makeMockLayoutManager();
    mockLayoutManager.getLayout.mockImplementation(async () => {
      return {
        id: "TEST_ID",
        name: "Test layout",
        baseline: { data: TEST_LAYOUT, updatedAt: new Date(10).toISOString() },
      };
    });
    mockLayoutManager.updateLayout.mockImplementation(async () => {
      condvar.notifyAll();
      return {
        id: "TEST_ID",
        name: "Test layout",
        baseline: { data: TEST_LAYOUT, updatedAt: new Date(10).toISOString() },
      };
    });
    const mockUserProfile = makeMockUserProfile();
    mockUserProfile.getUserProfile.mockResolvedValue({ currentLayoutId: "example" });

    const { result } = renderTest({
      mockLayoutManager,
      mockUserProfile,
    });
    await act(async () => await result.current.childMounted);
    const actions = result.current.actions;
    expect(result.current.actions).toBe(actions);
    act(() =>
      result.current.actions.savePanelConfigs({
        configs: [{ id: "ExamplePanel!1", config: { foo: "bar" } }],
      }),
    );
    await act(async () => await layoutStoragePutCalled);
    expect(result.current.actions.savePanelConfigs).toBe(actions.savePanelConfigs);
    (console.warn as jest.Mock).mockClear();
  });
});
