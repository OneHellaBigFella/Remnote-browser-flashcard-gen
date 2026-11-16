// Builds the layout RemNote expects (same as the official remnote-plugin-template-react):
//   dist/index.html            loader page, picks <widgetName>-sandbox.js from ?widgetName=
//   dist/index.js              native build (banner defines IMPORT_META for the SDK)
//   dist/index-sandbox.js      sandbox build (no banner)
//   dist/manifest.json, README.md
// `node build.mjs --watch` rebuilds on change (used by serve.mjs); PluginZip.zip is written for production builds.
import { build, context } from "esbuild";
import { cpSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const require = createRequire(import.meta.url);
const watch = process.argv.includes("--watch");

// Validate the manifest with the SDK's own parser (the `remnote-plugin validate` CLI assumes the plugin is the git root).
const { parseManifest } = require(require.resolve("@remnote/plugin-sdk/package.json").replace("package.json", "dist/lib.js"));
const parsed = parseManifest(JSON.parse(readFileSync("public/manifest.json", "utf8")));
if (!parsed.success) {
  console.error("manifest.json is invalid:\n" + parsed.errors.map((e) => `  ${e.field}: ${e.message}`).join("\n"));
  process.exit(1);
}

const LOADER = `<body></body>
<script type="text/javascript">
const queryParams = Object.fromEntries(new URLSearchParams(window.location.search).entries());
const widgetName = queryParams["widgetName"];
if (widgetName == undefined) { document.body.innerHTML += "Widget ID not specified."; }
const s = document.createElement('script');
s.type = "module";
s.src = widgetName + "-sandbox.js";
document.body.appendChild(s);
</script>`;

const common = {
  entryPoints: { index: "src/widgets/index.tsx" },
  bundle: true, format: "esm", platform: "browser", target: "es2020",
  minify: !watch, outdir: "dist", jsx: "transform", sourcemap: watch ? "inline" : false,
  define: { "process.env.NODE_ENV": watch ? '"development"' : '"production"' },
  logLevel: "warning",
};
const native = { ...common, entryNames: "[name]", banner: { js: "const IMPORT_META=import.meta;" } };
const sandbox = { ...common, entryNames: "[name]-sandbox" };

function copyStatic() {
  mkdirSync("dist", { recursive: true });
  cpSync("public", "dist", { recursive: true });
  cpSync("README.md", "dist/README.md");
  writeFileSync("dist/index.html", LOADER);
}

if (!watch) rmSync("dist", { recursive: true, force: true });
if (watch) {
  copyStatic();
  const a = await context(native), b = await context(sandbox);
  await Promise.all([a.watch(), b.watch()]);
  console.log("watching src/ -> dist/");
} else {
  await Promise.all([build(native), build(sandbox)]);
  copyStatic();
  rmSync("PluginZip.zip", { force: true });
  execFileSync("zip", ["-r", "-q", "../PluginZip.zip", "."], { cwd: "dist" });
  console.log("plugin built: packages/remnote-plugin/dist and PluginZip.zip");
}
