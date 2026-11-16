import { declareIndexPlugin, ReactRNPlugin, WidgetLocation } from "@remnote/plugin-sdk";
import { importIntoDailyDoc, isPayload } from "../importer";

const MSG_TYPE = "rfg:import";
const ACK_TYPE = "rfg:ack";

function randomToken(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function onActivate(plugin: ReactRNPlugin) {
  await plugin.settings.registerStringSetting({
    id: "pairingToken",
    title: "Pairing token",
    description: "Copy this into the browser extension's options so only your extension can write to your Daily Document. Leave it as generated.",
    defaultValue: randomToken(),
  });
  await plugin.settings.registerStringSetting({
    id: "sourcePrefix",
    title: "Heading for each imported page",
    description: "Prefix shown before the page title under today's Daily Document.",
    defaultValue: "📥",
  });

  // 1. Messages from the browser extension (relayed by its content script on remnote.com via postMessage).
  window.addEventListener("message", async (ev: MessageEvent) => {
    const d = ev.data;
    if (!d || d.type !== MSG_TYPE) return;
    const reply = (body: object) => (ev.source as Window | null)?.postMessage({ type: ACK_TYPE, id: d.id, ...body }, "*");
    try {
      const expected = await plugin.settings.getSetting<string>("pairingToken");
      if (!expected || d.token !== expected) return reply({ ok: false, error: "bad-token" });
      if (!isPayload(d.payload)) return reply({ ok: false, error: "bad-payload" });
      const id = await importIntoDailyDoc(plugin as any, d.payload);
      reply({ ok: true, remId: id });
    } catch (e: any) {
      reply({ ok: false, error: String(e?.message ?? e) });
    }
  });

  // 2. Manual fallback: paste a copied block from the clipboard (mobile / PWA path).
  await plugin.app.registerCommand({
    id: "rfg-paste-clipboard",
    name: "Flashcard Generator: import cards from clipboard into Daily Document",
    keywords: "flashcard import clipboard daily",
    action: async () => {
      try {
        const markdown = (await navigator.clipboard.readText()).trim();
        if (!markdown) return void plugin.app.toast("Clipboard is empty");
        await importIntoDailyDoc(plugin as any, { title: "Pasted flashcards", url: "https://remnote.com", markdown });
        plugin.app.toast("Flashcards added to today's Daily Document");
      } catch (e: any) {
        plugin.app.toast("Import failed: " + (e?.message ?? e));
      }
    },
  });

  // 3. Sample block to verify the pipeline without the extension.
  await plugin.app.registerCommand({
    id: "rfg-insert-sample",
    name: "Flashcard Generator: insert sample cards into Daily Document",
    action: async () => {
      await importIntoDailyDoc(plugin as any, {
        title: "Flashcard Generator test",
        url: "https://remnote.com",
        markdown: "- Hypertrophy basics =- Muscle grows when mechanical tension is high enough\n  - Mechanical tension :< Force a muscle fibre produces while it resists load\n    - Primary driver of hypertrophy ;; Mechanical tension\n    - Scenario: lifting very light weights far from failure - is tension high enough? ;; No; effective reps need near-failure effort",
      });
      plugin.app.toast("Sample cards added");
    },
  });
}

async function onDeactivate(_: ReactRNPlugin) {}

declareIndexPlugin(onActivate, onDeactivate);
