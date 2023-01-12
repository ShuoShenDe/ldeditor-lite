// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import AddIcon from "@mui/icons-material/Add";
import { Divider, IconButton } from "@mui/material";
import { union } from "lodash";
import { useMemo, useRef, useState, ReactElement, useEffect } from "react";

import { SidebarContent } from "@foxglove/studio-base/components/SidebarContent";
import Stack from "@foxglove/studio-base/components/Stack";
import { useAnalytics } from "@foxglove/studio-base/context/AnalyticsContext";
import useGlobalVariables, {
  GlobalVariables,
} from "@foxglove/studio-base/hooks/useGlobalVariables";
import { AppEvent } from "@foxglove/studio-base/services/IAnalytics";

import Variable from "./Variable";
import helpContent from "./index.help.md";

const ANIMATION_RESET_DELAY_MS = 1500;

export default function VariablesSidebar(): ReactElement {
  const { globalVariables, setGlobalVariables } = useGlobalVariables();
  const globalVariableNames = useMemo(() => Object.keys(globalVariables), [globalVariables]);

  // Don't run the animation when the sidebar first renders
  const skipAnimation = useRef<boolean>(true);

  const analytics = useAnalytics();

  useEffect(() => {
    const timeoutId = setTimeout(() => (skipAnimation.current = false), ANIMATION_RESET_DELAY_MS);
    return () => clearTimeout(timeoutId);
  }, []);

  const previousGlobalVariablesRef = useRef<GlobalVariables | undefined>(globalVariables);
  const [changedVariables, setChangedVariables] = useState<string[]>([]);

  useEffect(() => {
    if (skipAnimation.current) {
      previousGlobalVariablesRef.current = globalVariables;
      return;
    }
    const newChangedVariables = union(
      Object.keys(globalVariables),
      Object.keys(previousGlobalVariablesRef.current ?? {}),
    ).filter((name) => {
      const previousValue = previousGlobalVariablesRef.current?.[name];
      return previousValue !== globalVariables[name];
    });

    setChangedVariables(newChangedVariables);
    previousGlobalVariablesRef.current = globalVariables;
    const timerId = setTimeout(() => setChangedVariables([]), ANIMATION_RESET_DELAY_MS);
    return () => clearTimeout(timerId);
  }, [globalVariables, skipAnimation]);

  return (
    <SidebarContent
      title="Variables"
      disablePadding
      helpContent={helpContent}
      trailingItems={[
        <IconButton
          data-testid="add-variable-button"
          key="add-global-variable"
          color="primary"
          disabled={globalVariables[""] != undefined}
          onClick={() => {
            setGlobalVariables({ "": '""' });
            void analytics.logEvent(AppEvent.VARIABLE_ADD);
          }}
        >
          <AddIcon />
        </IconButton>,
      ]}
    >
      <Stack flex="auto">
        <Divider />
        {globalVariableNames.map((name, idx) => (
          <Variable
            key={name}
            name={name}
            selected={!skipAnimation.current && changedVariables.includes(name)}
            index={idx}
          />
        ))}
      </Stack>
    </SidebarContent>
  );
}
