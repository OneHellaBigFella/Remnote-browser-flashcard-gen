import { build } from "esbuild";
import { cpSync, rmSync } from "node:fs";
rmSync("dist", { recursive: true, force: true });
cpSync("static", "dist", { recursive: true });
await build({ entryPoints: ["src/app.ts"], bundle: true, outfile: "dist/app.js", format: "iife", platform: "browser", target: "es2020", minify: true });
console.log("pwa built -> packages/pwa/dist (host over HTTPS, e.g. GitHub Pages, then Add to Home Screen)");
