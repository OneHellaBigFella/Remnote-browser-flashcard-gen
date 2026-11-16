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
| `packages/pwa` | Mobile share-target web app (sends to the inbox, or copies to clipboard as a fallback) |
| `packages/worker` | Cloudflare Worker inbox: fetches a shared page, makes the cards with Claude, holds them until RemNote pulls them |

## Install
```bash
npm install
npm run build
```
1. **Extension (desktop):** Chrome/Edge → `chrome://extensions` → Developer mode → *Load unpacked* → `packages/extension/dist/chrome`. Firefox: `about:debugging` → *Load Temporary Add-on* → `packages/extension/dist/firefox/manifest.json`.
2. **RemNote plugin** (installed per account, not into any document; it asks for access to your whole knowledge base because it must find and write under today's Daily Document):
   - Quick try: `npm run serve -w @rfg/remnote-plugin` (serves `http://localhost:8080`), then in RemNote: Settings → Plugins → *Build* → *Develop from localhost* → `http://localhost:8080`. Keep the server running while you use it.
   - Permanent: *Upload plugin* in RemNote is a **public marketplace submission** (needs approval and a public repo), not a private install. Until it is approved, use *Develop from localhost* (it only works on the device running the server).
   - Then run the command **"Flashcard Generator: insert sample cards into Daily Document"** to verify. Open today's Daily Document once first so it exists.
3. **Pair:** RemNote → Settings → Plugins → *Flashcard Generator Importer* → copy the *Pairing token* into the extension's Options, together with your Anthropic API key.

## Use
- Toolbar button → **Generate cards from this page** → edit the preview → **Send to Daily Doc**.
- Right-click → *Make RemNote flashcards from page / selection*, or `Alt+Shift+F`. Open the popup to review.
- Select text first to card only the selection.
- Optional **auto mode**: list domains in Options; those pages are carded and queued with no click (this spends API credit on every page you open there).
- If RemNote isn't open, cards wait in the queue (badge shows the count) and are sent once a RemNote tab is open.

## Mobile (Android): share any page, cards appear in your Daily Doc
Chrome for Android can't run extensions, so a small Cloudflare Worker acts as an inbox:
phone -> Worker (fetches the page, makes the cards with Claude) -> RemNote plugin pulls them into today's Daily Document.
Cards arrive the next time RemNote is open with the plugin running (checked on startup and every minute).

**1. Deploy the Worker (about 5 minutes, free Cloudflare plan is enough):**
```bash
cd packages/worker
npx wrangler login
npx wrangler kv namespace create INBOX      # paste the printed id into wrangler.toml
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put SUBMIT_TOKEN        # any long random string; used by your phone
npx wrangler secret put PULL_TOKEN          # a different long random string; used by RemNote
npx wrangler deploy                         # prints https://rfg-inbox.<you>.workers.dev
```
Model defaults to Sonnet 5.5 (`MODEL` in `wrangler.toml`; use `claude-opus-5-5` for best quality, slower).

**2. Tell the RemNote plugin about it:** Settings -> Plugins -> Flashcard Generator Importer -> set *Phone inbox URL* and *Phone inbox pull token* (the PULL_TOKEN). Run **"Flashcard Generator: check phone inbox now"** to test.

**3. Send pages from your phone (pick one):**
- **Tasker (any app, any screen).** Create a Task "Make flashcards" with an *HTTP Request* action: Method POST, URL `https://rfg-inbox.<you>.workers.dev/submit`, Headers `Authorization: Bearer <SUBMIT_TOKEN>` and `Content-Type: application/json`, Body `{"url":"%rfurl"}` (or, for the screen text read by AutoInput, `{"text":"%screentext","source":"screen"}`), Timeout 120, then a *Notify* action with `%http_data`. Trigger it from the Share menu (Tasker/AutoShare share target, which puts the shared link in `%rfurl`), a quick-settings tile, a button or a gesture. Cards are only made if the text is real content; the Worker ignores UI chrome for `source: screen`.
- **Installed web app (free).** Host `packages/pwa/dist` over HTTPS (GitHub Pages or Cloudflare Pages), open it in Chrome, menu -> *Install app*. Enter the Worker URL and submit token once. After that *Share -> Flashcards* sends the page straight to the inbox.
- Other browsers (Firefox/Edge on Android, Orion on iOS) can also run the extension directly.

Worker endpoints: `POST /submit` (submit token), `GET /inbox` and `POST /ack` (pull token), `GET /health`. Submissions are rate limited (`SUBMITS_PER_HOUR`, default 60). Unpulled cards expire after 30 days.

## Cost and privacy
- Your API key is stored in the browser's extension storage and sent only to `api.anthropic.com`. The extension calls Claude directly with no server.
- Default model is Claude Opus 5.5 (a typical article is a few cents); choose Sonnet 5.5 or Haiku 5.5 in Options to spend less.
- The pairing token is posted to iframes on remnote.com only; other plugins running in your RemNote could read it. Don't install untrusted RemNote plugins alongside it.
- With the Worker, your Anthropic key lives only as a Worker secret and the page text passes through your own Worker. Pages that block direct fetches fall back to `r.jina.ai`, which sees that URL. The submit and pull tokens are the only protection on your Worker: keep them secret.
- The PWA's local fallback fetches pages via `r.jina.ai` too.

## Develop
```bash
npm test      # core + plugin + worker unit tests
npm run e2e   # loads the unpacked extension in Chromium with mocked Claude and RemNote
```

## Not yet verified against real services
The e2e test uses a stub RemNote page, and the real Claude API has not been called. Check with real accounts: (1) the plugin writes under today's Daily Doc and the delimiters become working flashcards, (2) RemNote delivers `postMessage` to the plugin iframe (if it doesn't, use the clipboard command), (3) one live Claude generation passes the validator, (4) the RemNote plugin sandbox can `fetch` your Worker (CORS is open; if it is blocked, the clipboard path still works), (5) the Tasker recipe on a real phone.
