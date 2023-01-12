// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ReactRefreshPlugin from "@pmmmwh/react-refresh-webpack-plugin";
import SentryWebpackPlugin from "@sentry/webpack-plugin";
import { CleanWebpackPlugin } from "clean-webpack-plugin";
import CopyPlugin from "copy-webpack-plugin";
import HtmlWebpackPlugin from "html-webpack-plugin";
import path from "path";
import { Configuration, EnvironmentPlugin, WebpackPluginInstance } from "webpack";
import type { Configuration as WebpackDevServerConfiguration } from "webpack-dev-server";

import type { WebpackArgv } from "@foxglove/studio-base/WebpackArgv";
import { buildEnvironmentDefaults } from "@foxglove/studio-base/environment";
import { makeConfig } from "@foxglove/studio-base/webpack";

interface WebpackConfiguration extends Configuration {
  devServer?: WebpackDevServerConfiguration;
}

const devServerConfig: WebpackConfiguration = {
  // Use empty entry to avoid webpack default fallback to /src
  entry: {},

  // Output path must be specified here for HtmlWebpackPlugin within render config to work
  output: {
    publicPath: "",
    path: path.resolve(__dirname, ".webpack"),
  },

  devServer: {
    static: {
      directory: path.resolve(__dirname, ".webpack"),
    },
    hot: true,
    // The problem and solution are described at <https://github.com/webpack/webpack-dev-server/issues/1604>.
    // When running in dev mode two errors are logged to the dev console:
    //  "Invalid Host/Origin header"
    //  "[WDS] Disconnected!"
    // Since we are only connecting to localhost, DNS rebinding attacks are not a concern during dev
    allowedHosts: "all",
  },

  plugins: [new CleanWebpackPlugin()],
};

const mainConfig = (env: unknown, argv: WebpackArgv): Configuration => {
  const isDev = argv.mode === "development";
  const isServe = argv.env?.WEBPACK_SERVE ?? false;

  const allowUnusedVariables = isDev;

  const plugins: WebpackPluginInstance[] = [];

  if (isServe) {
    plugins.push(new ReactRefreshPlugin());
  }

  // Source map upload if configuration permits
  if (
    !isDev &&
    process.env.SENTRY_AUTH_TOKEN != undefined &&
    process.env.SENTRY_ORG != undefined &&
    process.env.SENTRY_PROJECT != undefined
  ) {
    plugins.push(
      new SentryWebpackPlugin({
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        include: path.resolve(__dirname, ".webpack"),
        setCommits:
          process.env.SENTRY_REPO && process.env.SENTRY_CURRENT_COMMIT
            ? { repo: process.env.SENTRY_REPO, commit: process.env.SENTRY_CURRENT_COMMIT }
            : undefined,
      }),
    );
  }

  const appWebpackConfig = makeConfig(env, argv, { allowUnusedVariables });

  const config: Configuration = {
    name: "main",

    ...appWebpackConfig,

    target: "web",
    context: path.resolve(__dirname, "src"),
    entry: "./index.tsx",
    devtool: isDev ? "eval-cheap-module-source-map" : "source-map",

    output: {
      publicPath: "auto",

      // Output filenames should include content hashes in order to cache bust when new versions are available
      filename: isDev ? "[name].js" : "[name].[contenthash].js",

      path: path.resolve(__dirname, ".webpack"),
    },

    plugins: [
      ...plugins,
      ...(appWebpackConfig.plugins ?? []),
      new EnvironmentPlugin(buildEnvironmentDefaults(argv.env?.FOXGLOVE_BACKEND ?? argv.mode)),
      new CopyPlugin({
        patterns: [{ from: "../material" }],
      }),
      new HtmlWebpackPlugin({
        templateContent: `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8">
      <meta name="apple-mobile-web-app-capable" content="yes">
      <meta property="og:title" content="LDEditor"/>
      <meta property="og:description" content="Open source visualization and debugging tool for robotics"/>
      <meta property="og:type" content="website"/>
      <meta property="og:image" content="https://foxglove.dev/images/og-image.jpeg"/>
      <meta property="og:url" content="https://liangdao.com/"/>
      <link rel="apple-touch-icon" sizes="180x180" href="ldicon.png" />
      <link rel="icon" type="image/png" sizes="32x32" href="ldicon-32x32.png" />
      <link rel="icon" type="image/png" sizes="16x16" href="ldicon-16x16.png" />
      <title>LDEditor</title>
    </head>
    <script>
      global = globalThis;
    </script>
    <body>
      <div id="root"></div>
    </body>
  </html>
  `,
      }),
    ],
  };

  return config;
};

export default [devServerConfig, mainConfig];
