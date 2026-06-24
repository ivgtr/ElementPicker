# Element Picker

**Element Picker** is a Chrome extension for visually selecting an HTML element on the current page and copying that element and its descendants as HTML, Markdown, or plain text.

It is designed as a small page-level utility for quickly extracting just the part of a web page you need, without opening DevTools.

- Start selection mode from the extension icon
- Highlight and adjust the current target on the page
- Copy as HTML, Markdown, or plain text
- Use direct copy or choose a format each time
- Adjust the target with keyboard shortcuts
- Keep settings inside the selection UI, without a popup or options page

The product requirements live in [docs/requirements.md](docs/requirements.md).

## Installation

### GitHub Releases

1. Open the [Releases page](../../releases).
2. Download the latest `element-picker-vX.Y.Z.zip` from **Assets**.
3. Extract the zip file.
4. Open `chrome://extensions/` in Chrome.
5. Enable **Developer mode**.
6. Click **Load unpacked**.
7. Select the extracted folder.

Chrome may show a developer mode warning because this extension is distributed through GitHub Releases.

### Manual Build

```bash
npm install
npm run build
```

Then load the `dist/` directory from `chrome://extensions/` with Developer mode enabled.

## Usage

1. Click the Element Picker extension icon.
2. Move the pointer over the page element you want to copy.
3. Adjust the target if needed.
4. Click or press `Enter` to confirm.
5. Copy directly, or choose `HTML`, `Markdown`, or `Text` depending on your settings.

### Shortcuts

| Key     | Action                                               |
| ------- | ---------------------------------------------------- |
| `W`     | Move to parent element.                              |
| `S`     | Move to child element.                               |
| `A`     | Move to previous sibling element.                    |
| `D`     | Move to next sibling element.                        |
| `Enter` | Confirm the current target.                          |
| `Esc`   | Cancel selection, or close the settings popup first. |

Sibling movement loops at the beginning or end of the sibling list.

## Settings

Open the small settings button shown during selection mode.

Available settings:

- **Copy mode**
  - `Direct copy`: click or press `Enter` to copy immediately using the default format.
  - `Choose format`: click or press `Enter` to show the format menu.
- **Default format**
  - `HTML`
  - `Markdown`
  - `Text`

Settings are stored in `chrome.storage.local`.

## Development

```bash
npm install
npm run dev
```

`npm run dev` runs Vite in watch mode and writes the extension build to `dist/`.

## Scripts

| Command              | Description                                             |
| -------------------- | ------------------------------------------------------- |
| `npm run dev`        | Build in watch mode for local extension development.    |
| `npm run build`      | Run TypeScript and create a production extension build. |
| `npm run type-check` | Run TypeScript without emitting files.                  |
| `npm run lint`       | Run ESLint.                                             |
| `npm run format`     | Format source and documentation with Prettier.          |

## Release Flow

All changes should be made on branches and merged into `main` through pull requests.

GitHub Releases are created automatically when a merged pull request has one of these labels:

- `release:patch`
- `release:minor`
- `release:major`

The release workflow:

1. Calculates the next version from the latest `vX.Y.Z` tag.
2. Updates `package.json` and `package-lock.json`.
3. Runs type-check, lint, and build.
4. Creates `element-picker-vX.Y.Z.zip` from the contents of `dist/`.
5. Creates a GitHub Release and attaches the zip.

If a pull request is merged without a release label, no release is created.

## Stack

- Chrome Extensions Manifest V3
- Vite
- `@crxjs/vite-plugin`
- TypeScript
- ESLint
- Prettier
- Turndown and GFM table support for Markdown conversion
