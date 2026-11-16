import { build } from "esbuild";
import { cpSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });
await build({
  entryPoints: ["src/index.tsx"], bundle: true, outfile: "dist/index.js", format: "iife",
  platform: "browser", target: "es2020", minify: true, define: { "process.env.NODE_ENV": '"production"' },
});
cpSync("public/manifest.json", "dist/manifest.json");
writeFileSync("dist/index.html", '<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script src="index.js"></script></body></html>');
console.log("plugin built -> packages/remnote-plugin/dist (zip its contents to install via RemNote > Plugins > Build > Develop from localhost, or upload the zip)");
