import { build } from "esbuild";
import { cpSync, mkdirSync, writeFileSync, rmSync } from "node:fs";

const common = { bundle: true, format: "iife", platform: "browser", target: "es2020", minify: true };
const entries = { background: "src/background.ts", extract: "src/extract.ts", bridge: "src/bridge.ts", popup: "src/popup.ts", options: "src/options.ts" };

const base = {
  manifest_version: 3, name: "RemNote Flashcard Generator", version: "0.1.0",
  description: "Turn any page into RemNote flashcards (Hunter's 10 Rules) and import them into today's Daily Document.",
  permissions: ["storage", "activeTab", "scripting", "contextMenus", "tabs"],
  host_permissions: ["https://api.anthropic.com/*", "https://www.remnote.com/*", ...(process.env.RFG_TEST_HOSTS ? process.env.RFG_TEST_HOSTS.split(",") : [])],
  optional_host_permissions: ["https://*/*", "http://*/*"],
  action: { default_popup: "popup.html", default_title: "Make flashcards" },
  options_ui: { page: "options.html", open_in_tab: true },
  content_scripts: [{ matches: ["https://www.remnote.com/*"], js: ["bridge.js"], all_frames: false, run_at: "document_idle" }],
  commands: { generate: { suggested_key: { default: "Alt+Shift+F" }, description: "Make flashcards from this page" } },
};
const targets = {
  chrome: { ...base, background: { service_worker: "background.js" } },
  firefox: { ...base, background: { scripts: ["background.js"] }, browser_specific_settings: { gecko: { id: "flashcard-gen@remnote.local", data_collection_permissions: { required: ["none"] } } } },
};

for (const [name, manifest] of Object.entries(targets)) {
  const out = `dist/${name}`;
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  for (const [n, f] of Object.entries(entries)) await build({ ...common, entryPoints: [f], outfile: `${out}/${n}.js` });
  cpSync("static", out, { recursive: true });
  writeFileSync(`${out}/manifest.json`, JSON.stringify(manifest, null, 2));
}
console.log("built dist/chrome and dist/firefox");
