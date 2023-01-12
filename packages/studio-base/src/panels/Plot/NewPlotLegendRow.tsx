// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import CircleIcon from "@mui/icons-material/Circle";
import CircleOutlinedIcon from "@mui/icons-material/CircleOutlined";
import CircleTwoToneIcon from "@mui/icons-material/CircleTwoTone";
import CloseIcon from "@mui/icons-material/Close";
import ErrorIcon from "@mui/icons-material/Error";
import { IconButton, Tooltip, Typography } from "@mui/material";
import { ComponentProps, useMemo, useState } from "react";
import { makeStyles } from "tss-react/mui";
import { v4 as uuidv4 } from "uuid";

import { usePanelContext } from "@foxglove/studio-base/components/PanelContext";
import TimeBasedChart from "@foxglove/studio-base/components/TimeBasedChart";
import { useSelectedPanels } from "@foxglove/studio-base/context/CurrentLayoutContext";
import { useHoverValue } from "@foxglove/studio-base/context/TimelineInteractionStateContext";
import { useWorkspace } from "@foxglove/studio-base/context/WorkspaceContext";
import { getLineColor } from "@foxglove/studio-base/util/plotColors";

import { PlotPath } from "./internalTypes";

type PlotLegendRowProps = {
  index: number;
  path: PlotPath;
  paths: PlotPath[];
  hasMismatchedDataLength: boolean;
  datasets: ComponentProps<typeof TimeBasedChart>["data"]["datasets"];
  currentTime?: number;
  savePaths: (paths: PlotPath[]) => void;
  showPlotValuesInLegend: boolean;
};

const ROW_HEIGHT = 28;

const useStyles = makeStyles<void, "plotName">()((theme, _params, classes) => ({
  root: {
    display: "contents",

    "&:hover, &:focus-within": {
      "& > *:last-child": {
        opacity: 1,
      },
      "& > *": {
        backgroundColor: theme.palette.background.paper,
        backgroundImage: `linear-gradient(${[
          "0deg",
          theme.palette.action.focus,
          theme.palette.action.focus,
        ].join(" ,")})`,
      },
    },
  },
  showPlotValue: {
    [`.${classes.plotName}`]: {
      gridColumn: "span 1",
    },
  },
  listIcon: {
    display: "flex",
    alignItems: "center",
    position: "sticky",
    padding: theme.spacing(0, 0.25),
    height: ROW_HEIGHT,
    left: 0,
  },
  legendIconButton: {
    padding: `${theme.spacing(0.75)} !important`,
    marginLeft: theme.spacing(0.125),
    fontSize: theme.typography.pxToRem(14),
  },
  plotName: {
    display: "flex",
    alignItems: "center",
    height: ROW_HEIGHT,
    padding: theme.spacing(0, 1, 0, 0.25),
    gridColumn: "span 2",
  },
  plotValue: {
    display: "flex",
    alignItems: "center",
    height: ROW_HEIGHT,
    padding: theme.spacing(0.25),
  },
  actionButton: {
    padding: `${theme.spacing(0.25)} !important`,
    color: theme.palette.text.secondary,

    "&:hover": {
      color: theme.palette.text.primary,
    },
  },
  actions: {
    height: ROW_HEIGHT,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing(0.25),
    padding: theme.spacing(0.25),
    position: "sticky",
    right: 0,
    opacity: 0,

    "&:hover": {
      opacity: 1,
    },
  },
}));

export function NewPlotLegendRow({
  index,
  path,
  paths,
  hasMismatchedDataLength,
  datasets,
  currentTime,
  savePaths,
  showPlotValuesInLegend,
}: PlotLegendRowProps): JSX.Element {
  const { openPanelSettings } = useWorkspace();
  const { id: panelId } = usePanelContext();
  const { setSelectedPanelIds } = useSelectedPanels();
  const { classes, cx } = useStyles();

  const correspondingData = useMemo(() => {
    if (!showPlotValuesInLegend) {
      return [];
    }
    return datasets.find((set) => set.label === path.value)?.data ?? [];
  }, [datasets, path.value, showPlotValuesInLegend]);

  const [hoverComponentId] = useState<string>(() => uuidv4());
  const hoverValue = useHoverValue({
    componentId: hoverComponentId,
    isTimestampScale: true,
  });

  const [hover, setHover] = useState(false);

  const currentValue = useMemo(() => {
    if (!showPlotValuesInLegend) {
      return undefined;
    }
    const timeToCompare = hoverValue?.value ?? currentTime;

    let value;
    for (const pt of correspondingData) {
      if (timeToCompare == undefined || pt == undefined || pt.x > timeToCompare) {
        break;
      }
      value = pt.y;
    }
    return value;
  }, [showPlotValuesInLegend, hoverValue?.value, currentTime, correspondingData]);

  return (
    <div
      className={cx(classes.root, {
        [classes.showPlotValue]: showPlotValuesInLegend,
      })}
      onClick={() => {
        setSelectedPanelIds([panelId]);
        openPanelSettings();
      }}
    >
      <div className={classes.listIcon}>
        <IconButton
          className={classes.legendIconButton}
          centerRipple={false}
          size="small"
          title="Toggle visibility"
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onClick={(event) => {
            event.stopPropagation();

            const newPaths = paths.slice();
            const newPath = newPaths[index];

            if (newPath) {
              newPaths[index] = { ...newPath, enabled: !newPath.enabled };
            }
            savePaths(newPaths);
          }}
          style={{ color: getLineColor(path.color, index) }}
        >
          {path.enabled ? (
            <CircleIcon fontSize="inherit" />
          ) : hover ? (
            <CircleTwoToneIcon fontSize="inherit" />
          ) : (
            <CircleOutlinedIcon fontSize="inherit" />
          )}
        </IconButton>
      </div>
      <div
        className={classes.plotName}
        style={{ gridColumn: !showPlotValuesInLegend ? "span 2" : undefined }}
      >
        <Typography noWrap={true} flex="auto" variant="subtitle2">
          {path.label ?? `Series ${index + 1}`}
        </Typography>
        {hasMismatchedDataLength && (
          <Tooltip
            placement="top"
            title="Mismatch in the number of elements in x-axis and y-axis messages"
          >
            <ErrorIcon fontSize="small" color="error" />
          </Tooltip>
        )}
      </div>
      {showPlotValuesInLegend && (
        <div className={classes.plotValue}>
          <Typography
            component="div"
            variant="body2"
            align="right"
            color={hoverValue?.value != undefined ? "warning.main" : "text.secondary"}
          >
            {currentValue ?? ""}
          </Typography>
        </div>
      )}
      <div className={classes.actions}>
        <IconButton
          className={classes.actionButton}
          size="small"
          title={`Remove ${path.value}`}
          onClick={() => {
            const newPaths = paths.slice();
            newPaths.splice(index, 1);
            savePaths(newPaths);
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </div>
    </div>
  );
}
