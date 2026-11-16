# RemNote Flashcard Generator

Turn the page you're reading into RemNote flashcards built with **Hunter's 10 Rules** ([`rules/hunters-10-rules.md`](rules/hunters-10-rules.md)) and drop them into **today's Daily Document**.

```
page -> extension (Readability) -> Claude (JSON cards) -> rule validator -> RemNote block
     -> queue -> RemNote tab -> importer plugin -> Daily Doc  (📥 <page title> > cards)
```

## Packages
| Package | What it is |
|---|---|
| `packages/core` | Prompt (the 10 Rules + gates), JSON schema, validator (answer ≤15 words, no >3-item sets, no yes/no, no source refs), RemNote renderer, Claude client with one auto-repair pass |
| `packages/extension` | Manifest V3 extension (Chrome/Edge build + Firefox build) |
| `packages/remnote-plugin` | RemNote plugin that writes the cards into today's Daily Document |
| `packages/pwa` | Mobile share-target web app (copy to clipboard, then import via a plugin command) |

## Install
```bash
npm install
npm run build
```
1. **Extension (desktop):** Chrome/Edge → `chrome://extensions` → Developer mode → *Load unpacked* → `packages/extension/dist/chrome`. Firefox: `about:debugging` → *Load Temporary Add-on* → `packages/extension/dist/firefox/manifest.json`.
2. **RemNote plugin:** RemNote → Settings → Plugins → *Build* → *Develop from localhost* (or upload a zip of `packages/remnote-plugin/dist`). Run the command **"Flashcard Generator: insert sample cards into Daily Document"** to verify.
3. **Pair:** RemNote → Settings → Plugins → *Flashcard Generator Importer* → copy the *Pairing token* into the extension's Options, together with your Anthropic API key.

## Use
- Toolbar button → **Generate cards from this page** → edit the preview → **Send to Daily Doc**.
- Right-click → *Make RemNote flashcards from page / selection*, or `Alt+Shift+F`. Open the popup to review.
- Select text first to card only the selection.
- Optional **auto mode**: list domains in Options; those pages are carded and queued with no click (this spends API credit on every page you open there).
- If RemNote isn't open, cards wait in the queue (badge shows the count) and are sent once a RemNote tab is open.

## Mobile
Chrome for Android and iOS Safari don't run Chrome extensions. Options:
- Firefox / Edge for Android, or Orion on iOS: install the same extension.
- Any mobile browser: host `packages/pwa/dist` over HTTPS, *Add to Home Screen*, then *Share → Flashcards*. It generates a block you copy, then run **"import cards from clipboard into Daily Document"** in RemNote.

## Cost and privacy
- Your API key is stored in the browser's extension storage and sent only to `api.anthropic.com`. The extension calls Claude directly with no server.
- Default model is Claude Opus 5.5 (a typical article is a few cents); choose Sonnet 5.5 or Haiku 5.5 in Options to spend less.
- The pairing token is posted to iframes on remnote.com only; other plugins running in your RemNote could read it. Don't install untrusted RemNote plugins alongside it.
- The PWA fetches pages via `r.jina.ai`, which sees the URL you share.

## Develop
```bash
npm test      # core + plugin unit tests
npm run e2e   # loads the unpacked extension in Chromium with mocked Claude and RemNote
```

## Not yet verified against real services
The e2e test uses a stub RemNote page, and the real Claude API has not been called. Check with real accounts: (1) the plugin writes under today's Daily Doc and the delimiters become working flashcards, (2) RemNote delivers `postMessage` to the plugin iframe (if it doesn't, use the clipboard command), (3) one live Claude generation passes the validator.
