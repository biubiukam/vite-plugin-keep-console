import type { ConsoleKeeperOptions } from "./types";
import { generateTransform } from "./transform";
import type { Plugin } from "vite";

export function ConsoleKeeper(options?: ConsoleKeeperOptions) {
  const transform = generateTransform(options);

  return {
    name: "vite-plugin-keep-console",
    enforce: "pre",
    apply: "build",
    transform,
  };
}
export default ConsoleKeeper as (options?: ConsoleKeeperOptions) => Plugin;
