import { getSettings, saveSettings, Settings } from "./settings";
const el = (id: string) => document.getElementById(id) as HTMLInputElement;
const keys: (keyof Settings)[] = ["apiKey", "model", "effort", "maxClusters", "pairingToken", "autoDomains", "openRemNote"];
getSettings().then((s) => keys.forEach((k) => { const e = el(k); if (e.type === "checkbox") e.checked = !!s[k]; else e.value = String(s[k]); }));
el("save").addEventListener("click", async () => {
  const s: any = await getSettings();
  keys.forEach((k) => { const e = el(k); s[k] = e.type === "checkbox" ? e.checked : e.type === "number" ? Number(e.value) : e.value.trim(); });
  const hosts = String(s.autoDomains).split("\n").map((h: string) => h.trim()).filter(Boolean);
  if (hosts.length) {
    // auto mode needs real host access (activeTab only covers explicit clicks); must run inside this click handler
    const ok = await chrome.permissions.request({ origins: hosts.flatMap((h: string) => [`https://${h}/*`, `https://*.${h}/*`]) });
    if (!ok) { document.getElementById("saved")!.textContent = "Auto mode needs the site permission - not saved"; return; }
  }
  await saveSettings(s);
  document.getElementById("saved")!.textContent = "Saved";
});
