# Explorer Divider (Obsidian plugin)

Explorer Divider adds a “divider note” you can place between notes in the File Explorer when you sort by a frontmatter `created` timestamp.

This plugin is designed to work with workflows where:

- New notes are quick-captured into a folder.
- A separate “sorting” plugin sorts File Explorer items by a YAML frontmatter field like `created`.

## What it does

- Creates one divider file per folder (command).
- Makes divider files draggable in the File Explorer.
- When dropped between two notes, updates the divider’s `created` frontmatter to the midpoint of the notes above/below.
- Optionally triggers an external sorting plugin refresh command so the explorer resort happens immediately.
- Highlights divider notes visually and blocks plain left-click (so you don’t accidentally open it while organizing).

## Requirements / assumptions

- Your notes have a frontmatter `created` field (typically a millisecond timestamp).
- Your sorting plugin is configured to sort by that `created` field (ascending).

## Commands

- Create divider in active file’s folder
    - Creates a divider note in the parent folder of the current active file (or vault root if no active file).

## Settings

- Divider file name
    - Default: `--------------.md`
- Sorting refresh command
    - Default: `enable-custom-sorting`
    - You can enter either:
        - a full command id like `some-plugin-id:enable-custom-sorting`, or
        - just the suffix `enable-custom-sorting` (Explorer Divider resolves it).

## Notes on stability

Drag-and-drop is implemented by listening to File Explorer DOM events. Obsidian updates that change the internal File Explorer structure can require adjustments.

## Development

- Install: `npm install`
- Dev (watch): `npm run dev`
- Build: `npm run build`

## Manual install

Copy these files into your vault folder:

- `main.js`
- `manifest.json`
- `styles.css`

Target path:

- `<your-vault>/.obsidian/plugins/Explorer-Divider/`
