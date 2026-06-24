# Agent Notes

## Project

Element Picker is a browser extension for visually selecting an HTML element on the current page and copying that element's content to the clipboard.

Read `docs/requirements.md` before implementation work. The requirements document is the source of truth for product scope.

## Initial Release Scope

Implement only the initial release requirements unless the user asks otherwise:

- Start element selection mode from the browser extension icon.
- Highlight the element currently under the pointer.
- Confirm the target element by clicking it.
- Prevent the page's native links, buttons, and click handlers from firing while selecting.
- Let the user choose one copy format: HTML, Markdown, or plain text.
- Copy only the selected element and its descendants.
- Notify the user on success, failure, or cancellation.
- Allow cancellation.
- Clean up all injected UI and temporary page state after selection ends.

## Out Of Scope For Initial Release

Do not implement these unless explicitly requested:

- Image copy or screenshot capture.
- JSON output.
- CSS selector or XPath copy.
- Multi-element selection.
- Cross-page collection.
- Copy history.
- Cloud sync.
- iframe or Shadow DOM support.

## Implementation Guidance

- Use the Manifest V3 + Vite + `@crxjs/vite-plugin` setup in this repository.
- Keep implementation inside the existing directories: `src/background`, `src/content`, and `src/shared`.
- Do not add popup, options, or offscreen pages unless a requirement needs them.
- Keep page-injected UI isolated and easy to remove.
- Do not leave styles, overlays, event listeners, or DOM nodes behind after cancellation or copy completion.
- Prioritize predictable copied output over preserving visual styling.
- Markdown conversion should favor reusable document structure over layout fidelity.

## Branch And Release Workflow

- Do not work directly on `main` for feature, fix, or documentation changes.
- Create a topic branch before making changes.
- Merge changes into `main` through a pull request.
- The GitHub release workflow runs when a pull request is merged into `main`.
- Add exactly one release label to a pull request when it should produce a GitHub Release:
  - `release:patch`
  - `release:minor`
  - `release:major`
- If no release label is present, the pull request should not create a release.
- Release assets are GitHub-only unpacked-extension zip files generated from `dist/`.
- Do not commit `dist/`, `node_modules/`, or local test copies of the extension.
- Keep `manifest.config.ts` as the source for the extension manifest, with the version read from `package.json`.

## Commands

- `npm run dev`: watch build into `dist/`.
- `npm run build`: type-check and production build.
- `npm run type-check`: TypeScript only.
- `npm run lint`: ESLint.
- `npm run format`: Prettier.
