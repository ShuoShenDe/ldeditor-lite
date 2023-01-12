// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { alpha, Theme, ThemeOptions } from "@mui/material";
import { CSSProperties } from "react";

type MuiLabComponents = {
  MuiFocusVisible?: {
    styleOverrides?: {
      root?: CSSProperties;
    };
  };
  MuiToggleButton?: {
    styleOverrides?: {
      root?: CSSProperties;
      label?: CSSProperties;
    };
  };
  MuiToggleButtonGroup?: {
    styleOverrides?: {
      root?: CSSProperties;
    };
  };
};

const iconHack = {
  "& svg:not(.MuiSvgIcon-root)": {
    fill: "currentColor",
    width: "1em",
    height: "1em",
    display: "inline-block",
    fontSize: "1.2857142857142856rem",
    transition: "fill 200ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
    flexShrink: 0,
    userSelect: "none",
  },
};

const disableBackgroundColorTransition = {
  transition: "none",
};

export default function muiComponents(theme: Theme): ThemeOptions["components"] & MuiLabComponents {
  const prefersDarkMode = theme.palette.mode === "dark";

  return {
    MuiCssBaseline: {
      styleOverrides: {
        "@global": {
          svg: {
            display: "block",
            maxWidth: "100%",
          },
        },
      },
    },
    MuiAvatar: {
      defaultProps: {
        variant: "rounded",
      },
      styleOverrides: {
        colorDefault: {
          color: "currentColor",
          backgroundColor: theme.palette.action.hover,
        },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        root: {
          ".MuiInputBase-root. .MuiAutocomplete-input.MuiInputBase-input": {
            padding: theme.spacing(1, 1.25),
          },
          ".MuiInputBase-root.MuiInputBase-sizeSmall": {
            paddingBottom: 0,

            ".MuiAutocomplete-input.MuiInputBase-inputSizeSmall": {
              padding: theme.spacing(0.5, 1),
            },
          },
          ".MuiInputBase-root .MuiAutocomplete-endAdornment": {
            marginRight: theme.spacing(-0.5),
          },
        },
        endAdornment: {
          top: `calc(50% - ${theme.spacing(1.5)})`,
        },
      },
    },
    MuiFab: {
      defaultProps: {
        color: "inherit",
      },
      styleOverrides: {
        root: {
          boxShadow: theme.shadows[2],
        },
        colorInherit: {
          backgroundColor: theme.palette.background.paper,
        },
      },
    },
    MuiFormControl: {
      defaultProps: {
        variant: "standard",
      },
    },
    MuiBadge: {
      styleOverrides: {
        badge: {
          height: 16,
          minWidth: 16,
          padding: theme.spacing(0, 0.25),
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          ...disableBackgroundColorTransition,
        },
        containedInherit: {
          backgroundColor: theme.palette.action.focus,
        },
      },
    },
    MuiButtonBase: {
      defaultProps: {
        disableRipple: true,
      },
    },
    MuiCard: {
      defaultProps: {
        variant: "outlined",
        square: false,
      },
    },
    MuiCardActionArea: {
      defaultProps: {
        disableRipple: true,
      },
      styleOverrides: {
        focusHighlight: {
          ...disableBackgroundColorTransition,
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          "&:last-child": {
            paddingBottom: theme.spacing(2),
          },
        },
      },
    },
    MuiCardHeader: {
      defaultProps: {
        titleTypographyProps: {
          variant: "h3",
        },
      },
      styleOverrides: {
        action: {
          alignSelf: undefined,
          marginTop: undefined,
          marginRight: undefined,
        },
      },
    },
    MuiCheckbox: {
      defaultProps: {
        disableRipple: true,
      },
    },
    MuiFormLabel: {
      styleOverrides: {
        root: {
          marginBottom: theme.spacing(0.5),
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        InputLabelProps: {
          shrink: false,
          sx: {
            position: "relative",
            transform: "none",
            marginBottom: 0.5,
          },
        },
      },
    },
    MuiFilledInput: {
      defaultProps: {
        disableUnderline: true,
      },
      styleOverrides: {
        input: {
          padding: theme.spacing(1, 1.25),
        },
        inputSizeSmall: {
          padding: theme.spacing(0.75, 1),
        },
        root: {
          borderRadius: theme.shape.borderRadius,

          "&.Mui-focused": {
            backgroundColor: theme.palette.action.focus,
          },
          "&.Mui-disabled": {
            opacity: 0.5,
          },
          ".MuiAutocomplete-root &": {
            paddingTop: 0,
          },
          ...disableBackgroundColorTransition,
        },
      },
    },
    MuiDialog: {
      defaultProps: {
        PaperProps: {
          elevation: 4,
        },
      },
      styleOverrides: {
        root: {
          ".MuiBackdrop-root": {
            backgroundColor: alpha(theme.palette.common.black, 0.4),
          },
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: theme.spacing(3),
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          ...theme.typography.body1,

          "& + .MuiDialogActions-root": {
            paddingTop: 0,
          },
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          ...theme.typography.h4,
          fontWeight: 600,
        },
      },
    },
    MuiFocusVisible: {
      styleOverrides: {
        root: {
          borderRadius: theme.shape.borderRadius,
        },
      },
    },
    MuiIconButton: {
      defaultProps: {
        centerRipple: false,
        disableRipple: true,
      },
      styleOverrides: {
        root: {
          borderRadius: theme.shape.borderRadius,
          ...iconHack,

          ".root-span": {
            display: "flex",
          },
          "&:hover": {
            backgroundColor: theme.palette.action.hover,
          },
          ...disableBackgroundColorTransition,
        },
      },
    },
    MuiInput: {
      styleOverrides: {
        input: {
          padding: theme.spacing(1, 1.25),
        },
        inputSizeSmall: {
          padding: theme.spacing(0.75, 1),
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        adornedEnd: {
          "&.MuiInputBase-sizeSmall": {
            paddingRight: theme.spacing(1),

            "& .MuiSvgIcon-root": {
              fontSize: "1rem",
            },
          },
        },
        adornedStart: {
          "&.MuiInputBase-sizeSmall": {
            paddingLeft: theme.spacing(1),

            "& .MuiSvgIcon-root": {
              fontSize: "1rem",
            },
            "& .MuiSelect-select": {
              paddingRight: `${theme.spacing(2)} !important`,
            },
          },
        },
        inputSizeSmall: {
          fontSize: theme.typography.body2.fontSize,
        },
        root: {
          "&.MuiInput-root": {
            marginTop: 0,
          },
        },
      },
    },
    MuiInputLabel: {
      defaultProps: {
        shrink: true,
        variant: "standard",
        sx: { position: "relative" },
      },
    },
    MuiLink: {
      defaultProps: {
        color: prefersDarkMode ? "secondary" : "primary",
      },
      styleOverrides: {
        root: {
          cursor: "pointer",
        },
      },
    },
    MuiListSubheader: {
      styleOverrides: {
        root: {
          lineHeight: theme.spacing(4),
        },
      },
    },
    MuiListItem: {
      // variants: [
      //   {
      //     props: { showSecondaryActionsOnHover: true },
      //     style: {
      //       "@media (pointer: fine)": {
      //         "& .MuiListItemSecondaryAction-root .MuiIconButton-root:last-child": {
      //           visibility: "hidden",
      //         },
      //         "&:hover": {
      //           "& .MuiListItemSecondaryAction-root .MuiIconButton-root:last-child": {
      //             visibility: "visible",
      //           },
      //         },
      //       },
      //     },
      //   },
      // ],
    },
    MuiListItemButton: {
      defaultProps: { disableRipple: true },
      styleOverrides: {
        root: {
          ...disableBackgroundColorTransition,
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: theme.shape.borderRadius,
        },
      },
    },
    MuiMenuItem: {
      defaultProps: {
        disableRipple: true,
      },
      styleOverrides: {
        root: {
          minHeight: 32,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        input: {
          boxSizing: "content-box",
          padding: theme.spacing(1, 1.25),
        },
        inputSizeSmall: {
          padding: theme.spacing(0.75, 1),
        },
      },
      defaultProps: {
        notched: false,
      },
    },
    MuiSelect: {
      defaultProps: {
        variant: "outlined",
      },
      styleOverrides: {
        select: {
          "&.MuiInputBase-input": {
            paddingTop: theme.spacing(1),
            paddingBottom: theme.spacing(1),
          },
          "&.MuiInputBase-inputSizeSmall": {
            paddingTop: theme.spacing(0.625),
            paddingBottom: theme.spacing(0.625),
          },
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 2,
        square: true,
      },
      styleOverrides: {
        elevation: {
          backgroundImage: "none !important",
        },
      },
    },
    MuiRadio: {
      defaultProps: {
        disableRipple: true,
        size: "small",
      },
    },
    MuiTab: {
      styleOverrides: {
        labelIcon: iconHack,
        root: {
          opacity: 0.8,

          "&.Mui-selected": {
            opacity: 1,
          },

          "&:not(.Mui-selected):hover": {
            opacity: 1,
            color: theme.palette.text.primary,
          },
        },
        selected: {},
      },
    },
    MuiTabs: {
      styleOverrides: {
        vertical: {
          ".MuiTabs-indicator": {
            left: 0,
            right: "auto",
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        stickyHeader: {
          backgroundColor: theme.palette.background.paper,
        },
      },
    },
    MuiToggleButton: {
      defaultProps: {
        disableRipple: true,
      },
      styleOverrides: {
        label: iconHack,
        root: {
          "&:active": {
            backgroundColor: alpha(
              theme.palette.text.primary,
              theme.palette.action.activatedOpacity,
            ),
          },
          "&.Mui-selected:active": {
            backgroundColor: alpha(
              theme.palette.primary.main,
              theme.palette.action.selectedOpacity + theme.palette.action.activatedOpacity,
            ),
          },
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          justifyContent: "space-between",
        },
      },
    },
    MuiTooltip: {
      defaultProps: {
        arrow: true,
      },
      styleOverrides: {
        arrow: {
          color: theme.palette.grey[700],
        },
        tooltip: {
          backgroundColor: theme.palette.grey[700],
          fontWeight: "normal",
          fontSize: "0.75rem",
        },
      },
    },
  };
}
