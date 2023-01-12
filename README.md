# empty-project

Empty project.

## Building and running on localhost

First install dependencies:

```sh
yarn install
```

To run web

```sh
yarn web:serve
```

To run desktop:

```sh
yarn desktop:start
```

## Error
Error: Cannot find module 'copy-webpack-plugin' #110
```
npm sheinkwrap
```

[webpack-cli] Failed to load 'D:\shuo\work\web-ldeditor\web\webpack.config.ts' config
[webpack-cli] packages/studio-base/webpack.ts:222:7 - error TS2321: Excessive stack depth comparing types 'CircularDependencyPlugin' and 'WebpackPluginInstance'.
solution: change yarn.lock
To do: check the yarn.lock and yarn install
