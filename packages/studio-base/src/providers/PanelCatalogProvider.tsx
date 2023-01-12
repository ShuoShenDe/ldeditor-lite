// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren, useMemo } from "react";

import { AppSetting } from "@foxglove/studio-base/AppSetting";
import Panel from "@foxglove/studio-base/components/Panel";
import { PanelExtensionAdapter } from "@foxglove/studio-base/components/PanelExtensionAdapter";
import { useExtensionCatalog } from "@foxglove/studio-base/context/ExtensionCatalogContext";
import PanelCatalogContext, {
  PanelCatalog,
  PanelInfo,
} from "@foxglove/studio-base/context/PanelCatalogContext";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks/useAppConfigurationValue";
import panels from "@foxglove/studio-base/panels";
import { SaveConfig } from "@foxglove/studio-base/types/panels";

type PanelProps = {
  config: unknown;
  saveConfig: SaveConfig<unknown>;
};

export default function PanelCatalogProvider(
  props: PropsWithChildren<unknown>,
): React.ReactElement {
  const [showDebugPanels = false] = useAppConfigurationValue<boolean>(AppSetting.SHOW_DEBUG_PANELS);
  const [enableLegacyPlotPanel = false] = useAppConfigurationValue<boolean>(
    AppSetting.ENABLE_LEGACY_PLOT_PANEL,
  );

  const extensionPanels = useExtensionCatalog((state) => state.installedPanels);

  const wrappedExtensionPanels = useMemo<PanelInfo[]>(() => {
    return Object.values(extensionPanels ?? {}).map((panel) => {
      const panelType = `${panel.extensionName}.${panel.registration.name}`;
      const PanelWrapper = (panelProps: PanelProps) => {
        return (
          <>
            <PanelExtensionAdapter
              config={panelProps.config}
              saveConfig={panelProps.saveConfig}
              initPanel={panel.registration.initPanel}
            />
          </>
        );
      };
      PanelWrapper.panelType = panelType;
      PanelWrapper.defaultConfig = {};
      return {
        category: "misc",
        title: panel.registration.name,
        type: panelType,
        module: async () => ({ default: Panel(PanelWrapper) }),
        extensionNamespace: panel.extensionNamespace,
      };
    });
  }, [extensionPanels]);

  const allPanels = useMemo(() => {
    return [...panels.builtin, ...panels.debug, ...panels.legacyPlot, ...wrappedExtensionPanels];
  }, [wrappedExtensionPanels]);

  const visiblePanels = useMemo(() => {
    const legacyPlotPanels = enableLegacyPlotPanel ? panels.legacyPlot : [];

    // debug panels are hidden by default, users can enable them within app settings
    return showDebugPanels
      ? [...panels.builtin, ...panels.debug, ...legacyPlotPanels, ...wrappedExtensionPanels]
      : [...panels.builtin, ...legacyPlotPanels, ...wrappedExtensionPanels];
  }, [enableLegacyPlotPanel, showDebugPanels, wrappedExtensionPanels]);

  const panelsByType = useMemo(() => {
    const byType = new Map<string, PanelInfo>();

    for (const panel of allPanels) {
      const type = panel.type;
      byType.set(type, panel);
    }
    return byType;
  }, [allPanels]);

  const provider = useMemo<PanelCatalog>(() => {
    return {
      getPanels() {
        return visiblePanels;
      },
      getPanelByType(type: string) {
        return panelsByType.get(type);
      },
    };
  }, [panelsByType, visiblePanels]);

  return (
    <PanelCatalogContext.Provider value={provider}>{props.children}</PanelCatalogContext.Provider>
  );
}
