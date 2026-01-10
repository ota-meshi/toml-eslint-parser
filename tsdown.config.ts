import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  outDir: "lib",
  platform: "node",
  outExtension: () => ({ js: ".js", dts: ".d.ts" }),
});
