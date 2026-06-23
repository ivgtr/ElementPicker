# Element Picker

Element Picker is a Chrome extension for visually selecting an HTML element on the current page and copying that element and its descendants as HTML, Markdown, or plain text.

The product requirements live in [docs/requirements.md](docs/requirements.md).

## Development

```bash
npm install
npm run dev
```

`npm run dev` runs Vite in watch mode and writes the extension build to `dist/`.

To load the extension in Chrome:

1. Run `npm run build`.
2. Open `chrome://extensions/`.
3. Enable Developer mode.
4. Choose "Load unpacked".
5. Select the `dist/` directory.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Build in watch mode for local extension development. |
| `npm run build` | Run TypeScript and create a production extension build. |
| `npm run type-check` | Run TypeScript without emitting files. |
| `npm run lint` | Run ESLint. |
| `npm run format` | Format source and documentation with Prettier. |

## Stack

- Chrome Extensions Manifest V3
- Vite
- @crxjs/vite-plugin
- TypeScript
- ESLint
- Prettier
- Turndown for future HTML-to-Markdown conversion

## Scope

This repository is currently set up for implementation. The extension behavior itself is intentionally not implemented yet.
