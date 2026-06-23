import { defineManifest } from '@crxjs/vite-plugin';
import packageJson from './package.json' with { type: 'json' };

export default defineManifest({
  manifest_version: 3,
  name: 'Element Picker',
  version: packageJson.version,
  description:
    'Select an element on the current page and copy it as HTML, Markdown, or plain text.',
  permissions: ['activeTab', 'scripting', 'clipboardWrite'],
  action: {
    default_title: 'Pick an element',
    default_icon: {
      '16': 'icon.png',
      '32': 'icon.png',
      '48': 'icon.png',
      '128': 'icon.png',
    },
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  icons: {
    '16': 'icon.png',
    '32': 'icon.png',
    '48': 'icon.png',
    '128': 'icon.png',
  },
});
