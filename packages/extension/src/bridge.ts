/** Runs on www.remnote.com. Relays queued payloads to the RemNote plugin iframe(s) and returns the plugin's ack. */
const pending = new Map<string, (r: { ok: boolean; error?: string; remId?: string }) => void>();

window.addEventListener("message", (ev) => {
  const d = ev.data;
  if (d?.type === "rfg:ack" && pending.has(d.id)) {
    const done = pending.get(d.id)!;
    // a wrong-token / non-plugin iframe answers ok:false - keep waiting for the real one unless it's the last
    if (d.ok) { pending.delete(d.id); done(d); }
  }
});

function send(id: string, token: string, payload: unknown, timeoutMs = 10000): Promise<{ ok: boolean; error?: string; remId?: string }> {
  return new Promise((resolve) => {
    pending.set(id, resolve);
    const frames = Array.from(document.querySelectorAll("iframe"));
    for (const f of frames) f.contentWindow?.postMessage({ type: "rfg:import", id, token, payload }, "*");
    setTimeout(() => {
      if (pending.delete(id)) resolve({ ok: false, error: frames.length ? "no-plugin-response" : "remnote-not-ready" });
    }, timeoutMs);
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "rfg:send") return;
  send(msg.id, msg.token, msg.payload).then(sendResponse);
  return true;
});
