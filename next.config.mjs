import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    config.resolve.alias = {
      ...config.resolve.alias,
      // Force the browser build (the default entry pulls in react-native/fs).
      alasql$: path.resolve(__dirname, "node_modules/alasql/dist/alasql.min.js"),
      "react-native": false,
    };
    return config;
  },
};
export default nextConfig;
