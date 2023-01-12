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

import { CSSProperties } from "react";
import { makeStyles } from "tss-react/mui";

const DEFAULT_END_TEXT_LENGTH = 16;

const useStyles = makeStyles()(() => ({
  root: {
    alignSelf: "start",
    display: "flex",
    justifyContent: "flex-start",
    overflow: "hidden",
  },
  start: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flexShrink: 1,
  },
  end: {
    whiteSpace: "nowrap",
    flexBasis: "content",
    flexGrow: 0,
    flexShrink: 0,
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
}));

type Props = {
  text: string;
  endTextLength?: number;
  className?: string;
  style?: CSSProperties;
};

export default function TextMiddleTruncate({
  text,
  endTextLength,
  className,
  style,
}: Props): JSX.Element {
  const { classes, cx } = useStyles();
  const startTextLen = Math.max(
    0,
    text.length -
      (endTextLength == undefined || endTextLength === 0 ? DEFAULT_END_TEXT_LENGTH : endTextLength),
  );
  const startText = text.substring(0, startTextLen);
  const endText = text.substring(startTextLen);

  if (!startText) {
    return (
      <div className={cx(classes.end, className)} style={style}>
        {endText}
      </div>
    );
  }

  return (
    <div
      data-testid="text-middle-truncate"
      className={cx(className, classes.root)}
      title={text}
      style={style}
    >
      <div className={classes.start}>{startText}</div>
      <div className={classes.end}>{endText}</div>
    </div>
  );
}
