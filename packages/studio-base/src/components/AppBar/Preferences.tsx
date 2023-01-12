// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import CloseIcon from "@mui/icons-material/Close";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
  IconButton,
  IconButtonProps,
  Dialog,
  DialogProps,
  Tabs,
  Tab,
  FormControlLabel,
  Checkbox,
  Grid,
  Alert,
  useTheme,
  useMediaQuery,
  DialogActions,
  Button,
  Typography,
  Link,
} from "@mui/material";
import { MouseEvent, SyntheticEvent, useState } from "react";
import { makeStyles } from "tss-react/mui";

import { AppSetting } from "@foxglove/studio-base/AppSetting";
import OsContextSingleton from "@foxglove/studio-base/OsContextSingleton";
import CopyButton from "@foxglove/studio-base/components/CopyButton";
import { ExperimentalFeatureSettings } from "@foxglove/studio-base/components/ExperimentalFeatureSettings";
import FoxgloveLogoText from "@foxglove/studio-base/components/FoxgloveLogoText";
import { helpMenuItems } from "@foxglove/studio-base/components/HelpSidebar";
import {
  AutoUpdate,
  ColorSchemeSettings,
  LaunchDefault,
  MessageFramerate,
  RosPackagePath,
  TimeFormat,
  TimezoneSettings,
} from "@foxglove/studio-base/components/Preferences";
import Stack from "@foxglove/studio-base/components/Stack";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks";
import isDesktopApp from "@foxglove/studio-base/util/isDesktopApp";

const useStyles = makeStyles()((theme) => ({
  logo: {
    width: 212,
    height: "auto",
    marginLeft: theme.spacing(-1),
  },
  tabPanel: {
    visibility: "hidden",
    marginRight: "-100%",
    width: "100%",
    padding: theme.spacing(0, 4, 4),
  },
  tabPanelActive: {
    visibility: "visible",
  },
  iconButton: {
    padding: theme.spacing(0.75),
  },
  checkbox: {
    "&.MuiCheckbox-root": {
      paddingTop: 0,
    },
  },
  dialogActions: {
    position: "sticky",
    backgroundColor: theme.palette.background.paper,
    borderTop: `${theme.palette.divider} 1px solid`,
    padding: theme.spacing(1),
    bottom: 0,
  },
  formControlLabel: {
    "&.MuiFormControlLabel-root": {
      alignItems: "start",
    },
  },
  tab: {
    svg: {
      fontSize: "inherit",
    },
    "> span, > .MuiSvgIcon-root": {
      display: "flex",
      color: theme.palette.primary.main,
      marginRight: theme.spacing(1.5),
      height: theme.typography.pxToRem(21),
      width: theme.typography.pxToRem(21),
    },
    [theme.breakpoints.up("md")]: {
      textAlign: "right",
      flexDirection: "row",
      justifyContent: "flex-start",
      alignItems: "center",
      minHeight: "auto",
      paddingTop: theme.spacing(1.5),
      paddingBottom: theme.spacing(1.5),
    },
  },
  indicator: {
    [theme.breakpoints.up("md")]: {
      right: 0,
      width: "100%",
      backgroundColor: theme.palette.action.hover,
      borderRadius: theme.shape.borderRadius,
    },
  },
}));

export function PreferencesIconButton(props: IconButtonProps): JSX.Element {
  const { classes } = useStyles();

  return (
    <IconButton {...props} className={classes.iconButton}>
      <SettingsOutlinedIcon />
    </IconButton>
  );
}

type TabOption = "general" | "privacy" | "lab" | "about";

export function PreferencesDialog(props: DialogProps & { activeTab?: TabOption }): JSX.Element {
  const { activeTab: _activeTab } = props;
  const [activeTab, setActiveTab] = useState<TabOption>(_activeTab ?? "general");
  const [crashReportingEnabled, setCrashReportingEnabled] = useAppConfigurationValue<boolean>(
    AppSetting.CRASH_REPORTING_ENABLED,
  );
  const [telemetryEnabled, setTelemetryEnabled] = useAppConfigurationValue<boolean>(
    AppSetting.TELEMETRY_ENABLED,
  );
  const { classes, cx } = useStyles();
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up("md"));

  // automatic updates are a desktop-only setting
  //
  // electron-updater does not provide a way to detect if we are on a supported update platform
  // so we hard-code linux as an _unsupported_ auto-update platform since we cannot auto-update
  // with our .deb package install method on linux.
  const supportsAppUpdates = isDesktopApp() && OsContextSingleton?.platform !== "linux";

  const handleTabChange = (_event: SyntheticEvent, newValue: TabOption) => {
    setActiveTab(newValue);
  };

  const handleClose = (event: MouseEvent<HTMLElement>) => {
    if (props.onClose != undefined) {
      props.onClose(event, "backdropClick");
    }
  };

  return (
    <Dialog {...props} maxWidth="md">
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        paddingX={3}
        paddingY={2}
      >
        <Typography variant="h3" fontWeight={600}>
          Preferences
        </Typography>
        <IconButton edge="end" onClick={handleClose}>
          <CloseIcon />
        </IconButton>
      </Stack>
      <Grid container>
        <Grid item xs={12} md={3} paddingLeft={{ md: 1 }}>
          <Tabs
            classes={{ indicator: classes.indicator }}
            value={activeTab}
            orientation={mdUp ? "vertical" : "horizontal"}
            onChange={handleTabChange}
          >
            <Tab className={classes.tab} label="General" value="general" />
            <Tab className={classes.tab} label="Privacy" value="privacy" />
            <Tab className={classes.tab} label="Experimental features" value="lab" />
            <Tab className={classes.tab} label="About" value="about" />
          </Tabs>
        </Grid>
        <Grid item xs={12} md={9} paddingTop={{ xs: 4, md: 0 }}>
          <Stack direction="row">
            <section
              className={cx(classes.tabPanel, {
                [classes.tabPanelActive]: activeTab === "general",
              })}
            >
              <Stack gap={2}>
                <ColorSchemeSettings />
                <TimezoneSettings />
                <TimeFormat orientation={mdUp ? "horizontal" : "vertical"} />
                <MessageFramerate />
                {supportsAppUpdates && <AutoUpdate />}
                {!isDesktopApp() && <LaunchDefault />}
                <RosPackagePath />
              </Stack>
            </section>

            <section
              className={cx(classes.tabPanel, {
                [classes.tabPanelActive]: activeTab === "privacy",
              })}
            >
              <Stack gap={2}>
                <Alert color="info" icon={<InfoOutlinedIcon />}>
                  Changes will take effect the next time Foxglove Studio is launched.
                </Alert>
                <Stack gap={0.5} paddingLeft={2}>
                  <FormControlLabel
                    className={classes.formControlLabel}
                    control={
                      <Checkbox
                        className={classes.checkbox}
                        checked={telemetryEnabled ?? true}
                        onChange={(_event, checked) => void setTelemetryEnabled(checked)}
                      />
                    }
                    label="Send anonymized usage data to help us improve Foxglove Studio"
                  />
                  <FormControlLabel
                    className={classes.formControlLabel}
                    control={
                      <Checkbox
                        className={classes.checkbox}
                        checked={crashReportingEnabled ?? true}
                        onChange={(_event, checked) => void setCrashReportingEnabled(checked)}
                      />
                    }
                    label="Send anonymized crash reports"
                  />
                </Stack>
              </Stack>
            </section>

            <section
              className={cx(classes.tabPanel, { [classes.tabPanelActive]: activeTab === "lab" })}
            >
              <Stack gap={2}>
                <Alert color="warning" icon={<WarningAmberIcon />}>
                  These features are unstable and not recommended for daily use.
                </Alert>
                <Stack paddingLeft={2}>
                  <ExperimentalFeatureSettings />
                </Stack>
              </Stack>
            </section>

            <section
              className={cx(classes.tabPanel, { [classes.tabPanelActive]: activeTab === "about" })}
            >
              <Stack gap={2} alignItems="flex-start">
                <header>
                  <FoxgloveLogoText color="primary" className={classes.logo} />
                </header>
                <Stack direction="row" alignItems="center" gap={1}>
                  <Typography variant="body2">
                    Foxglove Studio version {FOXGLOVE_STUDIO_VERSION}
                  </Typography>
                  <CopyButton
                    size="small"
                    getText={() => {
                      if (FOXGLOVE_STUDIO_VERSION != undefined) {
                        return FOXGLOVE_STUDIO_VERSION.toString();
                      }
                      return "";
                    }}
                  />
                </Stack>
                {[
                  helpMenuItems.get("resources"),
                  helpMenuItems.get("products"),
                  helpMenuItems.get("contact"),
                  helpMenuItems.get("legal"),
                ].map((item) => {
                  return (
                    <Stack key={item?.subheader} gap={1}>
                      {item?.subheader && <Typography>{item.subheader}</Typography>}
                      {item?.links.map((link) => (
                        <Link
                          variant="body2"
                          underline="hover"
                          key={link.title}
                          data-testid={link.title}
                          href={link.url}
                          target="_blank"
                        >
                          {link.title}
                        </Link>
                      ))}
                    </Stack>
                  );
                })}
              </Stack>
            </section>
          </Stack>
        </Grid>
      </Grid>
      <DialogActions className={classes.dialogActions}>
        <Button onClick={handleClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
