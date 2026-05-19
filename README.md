# MÖRK BORG — Module Runner

A client-side React tool for running Mörk Borg adventure modules at the table. No backend, no auth, no database. Open the page, run the module.

**Bundled adventures:**
- **Graves Left Wanting** (Mörk Borg, full module — 13 nodes)
- **Smoke in the Reed Fields** (Ronin Borg, full one-shot — 6 nodes)

## What it does

**Runtime (GM tools at the table)**
- Node-based GM screen with full enemy stat blocks, NPCs, traps, items, secrets (tap to reveal), GM notes, breadcrumb trail
- **Dice tray** (key: `d`) — d20+modifier with DR check, damage rolls, all standard dice, roll history
- **Calendar of Nechrubel / Misery tracker** (key: `k`) — day counter, d6 roll for verses, triggered Misery log with notes
- **Party tracker** (key: `p`) — per-PC stat blocks (Str/Agl/Pre/Tou + HP/max + Omens + silver + conditions + notes), Broken-table d4 button, dead flag (auto-increments group death count)
- **Adventure map** (key: `m`) — SVG graph of nodes + exits, current node highlighted, click to jump
- **Rules reference panel** (key: `?`) — per-system, accordion sections
- **Keyboard shortcuts** — `?` rules · `b` back · `l` library · `m` map · `d` dice · `k` calendar · `p` party · `s` share · `esc` close

**Multi-system**
- Mörk Borg and Ronin Borg out of the box. Adventures declare `meta.system` and the runner loads the matching rules reference, applies a system-specific accent palette, and renames the brand title

**Library, builder, share**
- **Library** — bundled + your uploaded adventures (localStorage). Upload / drag-drop / delete
- **Adventure Builder** — *structured view* with per-node forms (enemies, NPCs, traps, exits, etc.) and *JSON view* with live validation. Save to library / download / save-and-run. Validation catches unreachable nodes, orphan exits, missing IDs
- **Share via URL** — gzipped adventure encoded in the URL hash via `CompressionStream`. No server. Recipient loads ephemerally with a banner offering to save
- **Community submissions** — see [CONTRIBUTING.md](./CONTRIBUTING.md) for the PR-based workflow

**Offline / install**
- Service worker caches assets and the bundled adventures. After first load, the app runs offline — including at-the-table tablet use with no wifi
- PWA manifest enables "Add to Home Screen" / install-as-app on iOS, Android, and desktop Chromium browsers

## Run locally

```bash
npm install
npm run dev
```

Vite serves at http://localhost:5173/module-runner/ by default.

To preview without the GitHub Pages base path:

```bash
VITE_BASE=/ npm run dev
```

## Build

```bash
npm run build
```

Output lands in `dist/`.

## Deploy to GitHub Pages

Two options:

**Option A — GitHub Actions (preferred).** The workflow in `.github/workflows/deploy.yml` builds on push to `main`/`master` and deploys via the official Pages action. Enable Pages in the repo settings → Pages → Source: *GitHub Actions*.

**Option B — gh-pages branch.**

```bash
npm run deploy
```

This builds and pushes `dist/` to the `gh-pages` branch using the `gh-pages` package.

If the repo is not named `module-runner`, edit the `base` default in `vite.config.js`.

## Project layout

```
src/
  components/   NodeView, EnemyCard, ItemList, RulesPanel, GMNotes,
                BreadcrumbTrail, PartyTracker, SecretsReveal, ExitButton,
                AdventurePicker, AdventureBuilder, ShareDialog,
                DiceTray, MiseryTracker, MapView
  data/         graves-left-wanting.json, ronin-borg-starter.json,
                rules-reference.json, rules-reference-ronin-borg.json,
                adventures-registry.json
  hooks/        useAdventure, useHistory
  utils/        validate, share, library, loadAdventure, dice
  styles/       theme.css, components.css
  App.jsx
  main.jsx
public/
  manifest.webmanifest
  sw.js
  icon.svg
  .nojekyll
```

## Adding a new adventure

Three options, in order of effort:

1. **Build it in-app**: click **✎ build**, paste or author JSON, hit **save & run**. Lives in localStorage.
2. **Upload a .json**: click **⌘ library → upload**. Same — saved locally only.
3. **Bundle it permanently**: see [CONTRIBUTING.md](./CONTRIBUTING.md) — add file to `src/data/`, register in `adventures-registry.json`, import in `utils/loadAdventure.js`, open PR.

## License

App code: MIT.

Bundled adventure content: based on official Mörk Borg material, published under the MÖRK BORG Third Party License. MÖRK BORG is © Ockult Örtmästare Games and Stockholm Kartell.
