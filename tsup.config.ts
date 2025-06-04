import { defineConfig } from "tsup";

const config = {
  clean: true,
  minify: false,
  sourcemap: false,
  treeshake: true,
  external: [
    "vite",
    "@babel/types",
    "@babel/generator",
    "@babel/traverse",
    "@babel/parser",
  ],
};

export default defineConfig([
  {
    entry: ["src/index.ts"],
    dts: true,
    format: ["cjs"],
    outDir: "dist/lib",
    ...config,
  },
  {
    entry: ["src/index.ts"],
    dts: true,
    format: ["esm"],
    outDir: "dist/es",
    ...config,
  },
]);
