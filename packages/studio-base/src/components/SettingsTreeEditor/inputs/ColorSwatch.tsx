// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { styled as muiStyled, Theme } from "@mui/material";
import tinycolor from "tinycolor2";

function calculateBorderColor(theme: Theme, color: string): string {
  const parsedColor = tinycolor(color);
  return parsedColor.isValid()
    ? theme.palette.getContrastText(parsedColor.toHexString())
    : theme.palette.text.primary;
}

export const ColorSwatch = muiStyled("div", {
  shouldForwardProp: (prop) => prop !== "color",
})<{ color: string }>(({ theme, color }) => ({
  // Color on top of white/black diagonal gradient. Color must be specified as a gradient because a
  // background color can't be stacked on top of a background image.
  background: `linear-gradient(${color}, ${color}), linear-gradient(to bottom right, white 50%, black 50%)`,
  aspectRatio: "1/1",
  width: theme.spacing(2.5),
  margin: theme.spacing(0.625),
  borderRadius: 1,
  border: `1px solid ${calculateBorderColor(theme, color)}`,
  flexShrink: 0,
}));
