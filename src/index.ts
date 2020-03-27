import { resolve } from "path";
import { spawn } from "child_process";

import Dotenv from "dotenv";
import { Configuration } from "webpack";
import { CleanWebpackPlugin as CleanPlugin } from "clean-webpack-plugin";
import CopyPlugin from "copy-webpack-plugin";
import HtmlPlugin from "html-webpack-plugin";
import DotenvPlugin from "dotenv-webpack";
import { resolveTsAliases } from "resolve-ts-aliases";

Dotenv.config();

const devMode = process.env.NODE_ENV === "development";
const platform = process.env.CORDOVA_DEV_PLATFORM;

if (!platform && devMode) {
  console.error("\n\u001b[1m\u001b[31mNeed env variable: CORDOVA_DEV_PLATFORM");
  process.exit(1);
}

const root = resolve(process.cwd());
const dist = resolve(root, "www");

const alias = resolveTsAliases(resolve(root, "tsconfig.json"));
const extensions = [".tsx", ".ts", ".jsx", ".js", ".json"];

const generateScopedName = devMode ? "[local]--[hash:base64:7]" : "[hash:base64:7]";

const config: Configuration = {
  devtool: "cheap-module-eval-source-map",
  resolve: {
    alias: {
      ...alias,
      "react-dom": "@hot-loader/react-dom"
    },
    extensions
  },
  context: resolve(root, "src"),
  entry: {
    index: "./index"
  },
  output: {
    filename: devMode ? "[name].js" : "[name].[hash:7].js",
    path: dist
  },
  externals: {
    cordova: "cordova"
  },
  optimization: {
    splitChunks: {
      cacheGroups: {
        commons: {
          name: "commons",
          test: /[\\/]node_modules[\\/]/,
          chunks: "all"
        }
      }
    }
  },
  module: {
    rules: [
      {
        test: /\.ejs$/,
        use: [
          { loader: "ejs-compiled-loader" }
        ]
      },
      {
        test: /\.(ts|js)x?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "babel-loader",
            options: {
              babelrc: false,
              cacheDirectory: true,
              presets: [
                "@babel/preset-env",
                "@babel/preset-typescript",
                "@babel/preset-react"
              ],
              plugins: [
                "@babel/plugin-proposal-class-properties",
                "@babel/plugin-proposal-object-rest-spread",
                ["@babel/plugin-transform-runtime", {
                  helpers: false
                }],
                ["babel-plugin-react-css-modules", {
                  context: resolve(process.cwd(), "src"),
                  exclude: "node_modules",
                  webpackHotModuleReloading: true,
                  autoResolveMultipleImports: true,
                  generateScopedName
                }],
                ["module-resolver", {
                  alias,
                  extensions
                }],
                "react-hot-loader/babel"
              ]
            }
          }
        ]
      },
      {
        test: /\.css$/,
        use: [
          {
            loader: "style-loader"
          },
          {
            loader: "css-loader",
            options: {
              modules: {
                localIdentName: generateScopedName
              }
            }
          },
          {
            loader: "postcss-loader",
            options: {
              ident: "postcss",
              plugins: () => [
                require("postcss-preset-env")({
                  stage: 3,
                  features: {
                    "nesting-rules": true
                  }
                })
              ]
            }
          }
        ]
      },
      {
        test: /\.(ttf|png|apng|svg)$/,
        use: [
          { loader: "url-loader" }
        ]
      }
    ]
  },
  plugins: [
    new DotenvPlugin({ systemvars: true }),
    new CleanPlugin({
      cleanOnceBeforeBuildPatterns: ["**/*", "!.gitignore", "!manifest.json"],
    }),
    new HtmlPlugin({
      template: "!!ejs-compiled-loader!src/index.ejs",
      templateParameters: {
        reactDevtools: devMode ? `//${process.env.DEV_HOST}:8097` : false
      }
    })
  ],
  devServer: {
    contentBase: dist,
    host: "0.0.0.0",
    hot: true,
    after: () => {
      devMode && spawn("react-devtools", { shell: true, stdio: "inherit" });
    }
  }
};

if (devMode) {
  config.plugins!.push(
    new CopyPlugin([
      {
        context: root,
        from: `platforms/${platform}/platform_www/{cordova.js,cordova_plugins.js,plugins/**/*}`,
        transformPath(targetPath, absolutePath) {
          return targetPath.replace(/^platforms\/[^\/]+\/platform_www\//, "");
        }
      },
      { from: "assets/**/*" }
    ])
  );
}

// fix: babel/babel-loader#603
const patch = {
  stats: {
    warningsFilter: /export .+ was not found/
  }
};

Object.assign(config, patch);
Object.assign(config.devServer, patch);

export default config;
