import TurndownService from 'turndown';
import type { CopyFormat } from '@/shared/messages';

const turndownService = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});

export const createCopyText = (element: HTMLElement, format: CopyFormat): string => {
  switch (format) {
    case 'html':
      return element.outerHTML.trim();
    case 'markdown':
      return turndownService.turndown(element.outerHTML).trim();
    case 'text':
      return element.innerText.trim();
  }
};

export const copyTextToClipboard = async (text: string): Promise<void> => {
  if (!text) {
    throw new Error('Copy result is empty.');
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the legacy copy path for pages where the Clipboard API is blocked.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';

  document.body.append(textarea);
  textarea.select();

  try {
    const copied = document.execCommand('copy');

    if (!copied) {
      throw new Error('Fallback copy command failed.');
    }
  } finally {
    textarea.remove();
  }
};
