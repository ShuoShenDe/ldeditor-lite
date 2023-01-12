// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import produce from "immer";
import { isEqual, isNumber, set } from "lodash";
import memoizeWeak from "memoize-weak";
import { useCallback, useEffect } from "react";

import { SettingsTreeAction, SettingsTreeNode, SettingsTreeNodes } from "@foxglove/studio";
import { AppSetting } from "@foxglove/studio-base/AppSetting";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks";
import { PlotPath } from "@foxglove/studio-base/panels/Plot/internalTypes";
import { usePanelSettingsTreeUpdate } from "@foxglove/studio-base/providers/PanelStateContextProvider";
import { SaveConfig } from "@foxglove/studio-base/types/panels";
import { lineColors } from "@foxglove/studio-base/util/plotColors";

import { plotableRosTypes, PlotConfig } from "./types";

const makeSeriesNode = memoizeWeak((path: PlotPath, index: number): SettingsTreeNode => {
  return {
    actions: [{ type: "action", id: "delete-series", label: "Delete" }],
    label: path.label ?? `Series ${index + 1}`,
    renamable: true,
    visible: path.enabled,
    fields: {
      value: {
        input: "messagepath",
        label: "Path",
        value: path.value,
        validTypes: plotableRosTypes,
      },
      color: {
        input: "rgb",
        label: "Color",
        value: path.color ?? lineColors[index % lineColors.length],
      },
      timestampMethod: {
        input: "select",
        label: "Timestamp",
        value: path.timestampMethod,
        options: [
          { label: "Receive Time", value: "receiveTime" },
          { label: "Header Stamp", value: "headerStamp" },
        ],
      },
    },
  };
});

const makeRootSeriesNode = memoizeWeak((paths: PlotPath[]): SettingsTreeNode => {
  const children = Object.fromEntries(
    paths.map((path, index) => [`${index}`, makeSeriesNode(path, index)]),
  );
  return {
    label: "Series",
    children,
    actions: [{ type: "action", id: "add-series", label: "Add series" }],
  };
});

// eslint-disable-next-line @foxglove/no-boolean-parameters
function buildSettingsTree(config: PlotConfig, enableSeries: boolean): SettingsTreeNodes {
  const maxYError =
    isNumber(config.minYValue) && isNumber(config.maxYValue) && config.minYValue >= config.maxYValue
      ? "Y max must be greater than Y min."
      : undefined;

  const maxXError =
    isNumber(config.minXValue) && isNumber(config.maxXValue) && config.minXValue >= config.maxXValue
      ? "X max must be greater than X min."
      : undefined;

  return {
    general: {
      label: "General",
      icon: "Settings",
      fields: {
        title: { label: "Title", input: "string", value: config.title, placeholder: "Plot" },
        isSynced: { label: "Sync with other plots", input: "boolean", value: config.isSynced },
      },
    },
    legend: {
      label: "Legend",
      fields: {
        legendDisplay: {
          label: "Position",
          input: "select",
          value: config.legendDisplay,
          options: [
            { value: "floating", label: "Floating" },
            { value: "left", label: "Left" },
            { value: "top", label: "Top" },
          ],
        },
        showPlotValuesInLegend: {
          label: "Show plot values",
          input: "boolean",
          value: config.showPlotValuesInLegend,
        },
      },
    },
    yAxis: {
      label: "Y Axis",
      defaultExpansionState: "collapsed",
      fields: {
        showYAxisLabels: {
          label: "Show labels",
          input: "boolean",
          value: config.showYAxisLabels,
        },
        minYValue: {
          label: "Min",
          input: "number",
          value: config.minYValue != undefined ? Number(config.minYValue) : undefined,
          placeholder: "auto",
        },
        maxYValue: {
          label: "Max",
          input: "number",
          error: maxYError,
          value: config.maxYValue != undefined ? Number(config.maxYValue) : undefined,
          placeholder: "auto",
        },
      },
    },
    xAxis: {
      label: "X Axis",
      defaultExpansionState: "collapsed",
      fields: {
        xAxisVal: {
          label: "Value",
          input: "select",
          value: config.xAxisVal,
          options: [
            { label: "Timestamp", value: "timestamp" },
            { label: "Index", value: "index" },
            { label: "Path (current)", value: "currentCustom" },
            { label: "Path (accumulated)", value: "custom" },
          ],
        },
        xAxisPath:
          config.xAxisVal === "currentCustom" || config.xAxisVal === "custom"
            ? {
                input: "messagepath",
                label: "Path",
                value: config.xAxisPath?.value ?? "",
                validTypes: plotableRosTypes,
              }
            : undefined,
        showXAxisLabels: {
          label: "Show labels",
          input: "boolean",
          value: config.showXAxisLabels,
        },
        minXValue: {
          label: "Min",
          input: "number",
          value: config.minXValue != undefined ? Number(config.minXValue) : undefined,
          placeholder: "auto",
        },
        maxXValue: {
          label: "Max",
          input: "number",
          error: maxXError,
          value: config.maxXValue != undefined ? Number(config.maxXValue) : undefined,
          placeholder: "auto",
        },
        followingViewWidth: {
          label: "Range (seconds)",
          input: "number",
          placeholder: "auto",
          value: config.followingViewWidth,
        },
      },
    },
    paths: enableSeries ? makeRootSeriesNode(config.paths) : undefined,
  };
}

export function usePlotPanelSettings(config: PlotConfig, saveConfig: SaveConfig<PlotConfig>): void {
  const updatePanelSettingsTree = usePanelSettingsTreeUpdate();
  const [enableSeries = false] = useAppConfigurationValue<boolean>(
    AppSetting.ENABLE_PLOT_PANEL_SERIES_SETTINGS,
  );

  const actionHandler = useCallback(
    (action: SettingsTreeAction) => {
      if (action.action === "update") {
        const { path, value } = action.payload;
        saveConfig(
          produce((draft) => {
            if (path[0] === "paths") {
              if (path[2] === "visible") {
                set(draft, [...path.slice(0, 2), "enabled"], value);
              } else {
                set(draft, path, value);
              }
            } else if (isEqual(path, ["xAxis", "xAxisPath"])) {
              set(draft, ["xAxisPath", "value"], value);
            } else {
              set(draft, path.slice(1), value);

              // X min/max and following width are mutually exclusive.
              if (path[1] === "followingViewWidth") {
                draft.minXValue = undefined;
                draft.maxXValue = undefined;
              } else if (path[1] === "minXValue" || path[1] === "maxXValue") {
                draft.followingViewWidth = undefined;
              }
            }
          }),
        );
      } else {
        if (action.payload.id === "add-series") {
          saveConfig(
            produce<PlotConfig>((draft) => {
              draft.paths.push({
                timestampMethod: "receiveTime",
                value: "",
                label: `Series ${draft.paths.length + 1}`,
                enabled: true,
              });
            }),
          );
        } else if (action.payload.id === "delete-series") {
          const index = action.payload.path[1];
          saveConfig(
            produce<PlotConfig>((draft) => {
              draft.paths.splice(Number(index), 1);
            }),
          );
        }
      }
    },
    [saveConfig],
  );

  useEffect(() => {
    updatePanelSettingsTree({
      actionHandler,
      nodes: buildSettingsTree(config, enableSeries),
    });
  }, [actionHandler, config, enableSeries, updatePanelSettingsTree]);
}
