# Presentation Engine

This folder is now a reusable presentation system, not just a single deck dump.

## Deck Contract

Each deck lives in its own folder:

`/Presentations/<deck-id>`

Required files:

- `manifest.json`
- `index.html`
- one or more slide files such as `01-title.html`, `02-problem.html`

Shared presenter behavior lives here:

- `/Presentations/_shared/deck-controls.css`
- `/Presentations/_shared/deck-controls.js`

Every slide should reference those shared assets:

```html
<link href="/Presentations/_shared/deck-controls.css" rel="stylesheet"/>
<script src="/Presentations/_shared/deck-controls.js"></script>
```

## What The Engine Gives You

- deck routing through `/Presentations/<deck-id>`
- manifest-driven next/prev navigation
- fullscreen presenter mode
- keyboard and click navigation
- notes toggle
- QR overlay toggle
- audience session sync
- shared controls across all decks

## Manifest Metadata

Deck behavior should live in `manifest.json` whenever possible.

Example audience block:

```json
{
  "audience": {
    "enabled": true,
    "liveSessionId": "your-deck-main",
    "qrOverlayEnabled": true,
    "contentByStep": {
      "slide1": {
        "eyebrow": "Live Session",
        "title": "Opening Idea",
        "body": "Audience-facing content for the first slide."
      }
    }
  }
}
```

This is now where per-deck audience copy and QR behavior should go.

## Raw HTML Import Workflow

If you hand Codex a block of presentation HTML that contains one or more complete slide documents, the expected path is:

1. Save the raw HTML to a file
2. Run:

```bash
npm run import:presentation -- \
  --input path/to/source.html \
  --deck-id your-deck-id \
  --title "Your Deck Title"
```

Optional flags:

- `--description "Short deck summary"`
- `--overwrite`

What the importer does:

- splits the source into individual slide files
- names slides with a numbered filename convention
- injects the shared presentation controls
- generates `manifest.json`
- generates a launchable `index.html`
- generates starter audience metadata for each slide step

## Dashboard Importer

The developer dashboard now includes a presentation importer panel.

Use it when you want to:

- paste raw HTML directly
- name the deck
- optionally overwrite an existing deck
- generate a launchable deck without using the terminal

## Editing Rules

- keep slides as standalone HTML files
- use the shared control assets instead of deck-local copies
- keep manifest slide order authoritative
- if a slide is intended to scroll, let that slide opt in locally
- if a slide is intended to fit one screen, keep that decision inside the slide CSS

## Codex Workflow

When the user says:

- "build this presentation"
- "import this HTML deck"
- "turn this into a presentation in /Presentations"

Codex should:

1. create or choose a deck id
2. import the raw HTML into `/Presentations/<deck-id>`
3. ensure slides use `/Presentations/_shared/deck-controls.css`
4. ensure slides use `/Presentations/_shared/deck-controls.js`
5. generate a valid manifest
6. make the deck launchable from `/Presentations`

That way the work is consistent every time.
