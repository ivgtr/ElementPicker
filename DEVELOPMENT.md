# Development

## Architecture

This project follows the setup patterns from a previous Chrome extension project, optimized for Element Picker's narrower initial scope.

- `manifest.config.ts` defines the Manifest V3 extension using `@crxjs/vite-plugin`.
- `src/background/` contains the service worker entrypoint.
- `src/content/` is reserved for the page-injected element picker UI.
- `src/shared/` is for message contracts and shared utilities.
- `public/` contains static extension assets copied into `dist/`.

Popup, options, and offscreen documents are intentionally omitted until a requirement needs them.

## Commands

```bash
npm install
npm run dev
npm run build
npm run type-check
npm run lint
npm run format
```

## Implementation Notes

- Read `docs/requirements.md` before changing behavior.
- Keep content script UI isolated from the host page.
- Prefer inline styles or Shadow DOM for injected UI so page CSS does not leak in or out.
- Remove all injected DOM nodes, styles, timers, and event listeners after copy, cancel, or failure.
- Do not add out-of-scope formats or collection features without an explicit request.

## Chrome Loading

Build with `npm run build`, then load `dist/` from `chrome://extensions/` with Developer mode enabled.
