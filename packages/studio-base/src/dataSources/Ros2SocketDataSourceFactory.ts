// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import Ros2Player from "@foxglove/studio-base/players/Ros2Player";
import { Player } from "@foxglove/studio-base/players/types";

class Ros2SocketDataSourceFactory implements IDataSourceFactory {
  public id = "ros2-socket";
  public type: IDataSourceFactory["type"] = "connection";
  public displayName = "ROS 2";
  public iconName: IDataSourceFactory["iconName"] = "ROS";
  public description =
    "Connect to a running ROS 2 system via a native UDP connection that accesses your ROS nodes directly.";
  public docsLinks = [{ url: "https://foxglove.dev/docs/studio/connection/ros2" }];
  public warning =
    "Native ROS 2 connections do not support custom messages, and are deprecated. We recommend using the Foxglove WebSocket connection instead.";

  public formConfig = {
    fields: [
      {
        id: "domainId",
        label: "ROS_DOMAIN_ID",
        defaultValue: "0",
        description:
          "Used by DDS, the default ROS 2 middleware, to compute the UDP ports used for discovery and communication",
      },
    ],
  };

  public initialize(args: DataSourceFactoryInitializeArgs): Player | undefined {
    const domainIdStr = args.params?.domainId;
    if (!domainIdStr) {
      return;
    }

    const domainId = parseInt(domainIdStr);

    return new Ros2Player({ domainId, metricsCollector: args.metricsCollector, sourceId: this.id });
  }
}

export default Ros2SocketDataSourceFactory;
