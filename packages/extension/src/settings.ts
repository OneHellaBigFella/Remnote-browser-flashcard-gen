export interface Settings {
  apiKey: string;
  model: string;
  effort: "low" | "medium" | "high";
  maxClusters: number;
  pairingToken: string;
  autoDomains: string; // newline separated; pages on these hosts are carded and queued with no click
  openRemNote: boolean; // open a background RemNote tab to flush the queue when none is open
}
export const DEFAULTS: Settings = {
  apiKey: "", model: "claude-opus-5-5", effort: "medium", maxClusters: 5,
  pairingToken: "", autoDomains: "", openRemNote: true,
};
export async function getSettings(): Promise<Settings> {
  const s = await chrome.storage.local.get("settings");
  return { ...DEFAULTS, ...(s.settings ?? {}) };
}
export const saveSettings = (s: Settings) => chrome.storage.local.set({ settings: s });

export interface Outbound { id: string; title: string; url: string; markdown: string; createdAt: number; }
export interface Pending { title: string; url: string; markdown: string; issues: string[]; gaps: string[]; scenarioNotes: string[]; usage: { input: number; output: number }; model: string; }
