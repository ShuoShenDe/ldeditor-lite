// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ReactElement } from "react";

import { LaunchPreferenceScreen } from "@foxglove/studio-base/screens/LaunchPreferenceScreen";

export default {
  title: "LaunchPreferenceScreen",
  component: LaunchPreferenceScreen,
};

export const Dark = (): ReactElement => {
  return <LaunchPreferenceScreen />;
};

Dark.parameters = { colorScheme: "dark" };

export const Light = (): ReactElement => {
  return <LaunchPreferenceScreen />;
};

Light.parameters = { colorScheme: "light" };
