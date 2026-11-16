// Dev server for RemNote's "Develop from localhost": builds with --watch and serves dist/ on :8080 with CORS.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const build = spawn(process.execPath, ["build.mjs", "--watch"], { stdio: "inherit" });
process.on("exit", () => build.kill());
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".md": "text/markdown", ".css": "text/css" };
const root = path.resolve("dist");

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const rel = url.pathname === "/" ? "/index.html" : url.pathname;
  const file = path.join(root, path.normalize(rel));
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "baggage, sentry-trace");
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-store" }).end(body);
  } catch { res.writeHead(404).end("not found"); }
}).listen(8080, "127.0.0.1", () => console.log("Serving the plugin at http://localhost:8080 - in RemNote: Settings > Plugins > Build > Develop from localhost"));
