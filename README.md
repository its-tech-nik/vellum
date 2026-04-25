# Vellum

> Just as medieval scribes used vellum to ensure their most important works were flawless and enduring, Vellum for Chrome ensures your product demos are recorded with perfect, error-free precision every time.

Chrome Extension (Manifest V3) that records multiline text snippets per URL and field selector, then replays them with human-like timing.

## Features

- Targets `input`, `textarea`, and `contenteditable` elements.
- Record shortcut: `Ctrl+Shift+R` (opens in-page recorder overlay near focused field).
- Replay shortcut: `Ctrl+Shift+P` (types saved snippet into focused field).
- Multiline text preserved exactly (`\n` retained in storage and replay).
- Human-like replay timing with randomized per-character jitter (±25%).
- Contenteditable newline strategy:
  - Enter simulation first (`insertLineBreak` behavior).
  - Fallback to direct `<br>` insertion when required.
- Popup dashboard for grouped URL snippets with view/edit/delete.

## Storage Model

Snippets are stored in `chrome.storage.local` under key:

- `typingSimulatorSnippets`

Structure:

```json
{
  "https://example.com/form": {
    "#messageBox": {
      "text": "Hello\\nWorld",
      "durationSec": 6,
      "updatedAt": 1713988800000
    }
  }
}
```

## Install (Developer Mode)

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `product-demo-recorder`.

## Usage

1. Focus a supported field on a webpage.
2. Press `Ctrl+Shift+R`.
3. Enter multiline text and a duration in seconds, then save.
4. Refocus that field and press `Ctrl+Shift+P` to replay.
5. Open extension popup from toolbar to edit/delete saved snippets.

## Notes

- This project includes custom icon assets in `assets/`.
- If a rich editor ignores standard line breaks, fallback insertion is used automatically.
