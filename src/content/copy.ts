import { formatHtmlForPlainText } from './html-format';
import { htmlToMarkdown } from './markdown';
import type { CopyFormat } from '@/shared/messages';

export const createCopyText = (element: HTMLElement, format: CopyFormat): string => {
  switch (format) {
    case 'html':
      return element.outerHTML.trim();
    case 'markdown':
      return htmlToMarkdown(element);
    case 'text':
      return element.innerText.trim();
  }
};

export const copySelectionToClipboard = async (
  element: HTMLElement,
  format: CopyFormat
): Promise<void> => {
  const text = createCopyText(element, format);

  if (format === 'html') {
    await copyHtmlToClipboard(text);
    return;
  }

  await copyTextToClipboard(text);
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

const copyHtmlToClipboard = async (html: string): Promise<void> => {
  if (!html) {
    throw new Error('Copy result is empty.');
  }

  const plainHtml = formatHtmlForPlainText(html);

  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plainHtml], { type: 'text/plain' }),
        }),
      ]);
      return;
    } catch {
      // Fall through to plain-text HTML for pages where rich clipboard writes are blocked.
    }
  }

  await copyTextToClipboard(plainHtml);
};
