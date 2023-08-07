import { defineConfig as defineTsupConfig } from "tsup";

/**
 * `tsup` configuration.
 * @see https://tsup.egoist.dev
 */
const tsupConfig = defineTsupConfig({
  entry: { knit: "src/knit.ts" },
  outDir: "build",
  format: ["cjs", "esm"],
  treeshake: true,
  sourcemap: true,
  minify: true,
  clean: true,
  dts: true,
  splitting: false,
});

export default tsupConfig;
