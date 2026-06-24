type HtmlToken =
  | {
      kind: 'startTag' | 'endTag' | 'voidTag';
      raw: string;
      tagName: string;
    }
  | {
      kind: 'comment' | 'doctype' | 'text' | 'rawTextBlock';
      raw: string;
      tagName?: string;
    };

const INDENT = '  ';

const BLOCK_TAGS = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'body',
  'dd',
  'details',
  'dialog',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'head',
  'header',
  'html',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'section',
  'ul',
]);

const TABLE_TAGS = new Set([
  'table',
  'caption',
  'colgroup',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
]);

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

const RAW_TEXT_TAGS = new Set(['script', 'style', 'pre', 'textarea']);

export const formatHtmlForPlainText = (html: string): string => {
  try {
    const tokens = tokenizeHtml(html);
    return tokens ? formatTokens(tokens).trim() : html.trim();
  } catch {
    return html.trim();
  }
};

const tokenizeHtml = (html: string): HtmlToken[] | null => {
  const tokens: HtmlToken[] = [];
  let index = 0;

  while (index < html.length) {
    const tagStart = findNextTagStart(html, index);

    if (tagStart === -1) {
      tokens.push({ kind: 'text', raw: html.slice(index) });
      break;
    }

    if (tagStart > index) {
      tokens.push({ kind: 'text', raw: html.slice(index, tagStart) });
    }

    if (html.startsWith('<!--', tagStart)) {
      const commentEnd = html.indexOf('-->', tagStart + 4);
      if (commentEnd === -1) {
        return null;
      }

      const endIndex = commentEnd + 3;
      tokens.push({ kind: 'comment', raw: html.slice(tagStart, endIndex) });
      index = endIndex;
      continue;
    }

    const tagEnd = findTagEnd(html, tagStart);

    if (tagEnd === -1) {
      return null;
    }

    const raw = html.slice(tagStart, tagEnd + 1);

    if (/^<!doctype\b/i.test(raw)) {
      tokens.push({ kind: 'doctype', raw });
      index = tagEnd + 1;
      continue;
    }

    const tagName = getTagName(raw);

    if (!tagName) {
      tokens.push({ kind: 'text', raw });
      index = tagEnd + 1;
      continue;
    }

    if (raw.startsWith('</')) {
      tokens.push({ kind: 'endTag', raw, tagName });
      index = tagEnd + 1;
      continue;
    }

    if (RAW_TEXT_TAGS.has(tagName) && !isSelfClosingTag(raw)) {
      const rawBlockEnd = findRawTextBlockEnd(html, tagEnd + 1, tagName);
      if (rawBlockEnd === -1) {
        return null;
      }

      tokens.push({ kind: 'rawTextBlock', raw: html.slice(tagStart, rawBlockEnd), tagName });
      index = rawBlockEnd;
      continue;
    }

    tokens.push({
      kind: VOID_TAGS.has(tagName) || isSelfClosingTag(raw) ? 'voidTag' : 'startTag',
      raw,
      tagName,
    });
    index = tagEnd + 1;
  }

  return tokens;
};

const findNextTagStart = (html: string, fromIndex: number): number => {
  let index = fromIndex;

  while (index < html.length) {
    const tagStart = html.indexOf('<', index);

    if (tagStart === -1) {
      return -1;
    }

    const next = html[tagStart + 1];

    if (next && /[!/A-Za-z?]/.test(next)) {
      return tagStart;
    }

    index = tagStart + 1;
  }

  return -1;
};

const findTagEnd = (html: string, tagStart: number): number => {
  let quote: '"' | "'" | null = null;

  for (let index = tagStart + 1; index < html.length; index += 1) {
    const char = html[index];

    if (quote) {
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === '>') {
      return index;
    }
  }

  return -1;
};

const findRawTextBlockEnd = (html: string, contentStart: number, tagName: string): number => {
  const lowerHtml = html.toLowerCase();
  let closeStart = contentStart;

  while (closeStart < html.length) {
    closeStart = lowerHtml.indexOf(`</${tagName}`, closeStart);

    if (closeStart === -1) {
      return -1;
    }

    const next = html[closeStart + tagName.length + 2];

    if (!next || /[\s>/]/.test(next)) {
      const closeEnd = findTagEnd(html, closeStart);
      return closeEnd === -1 ? -1 : closeEnd + 1;
    }

    closeStart += tagName.length + 2;
  }

  return html.length;
};

const getTagName = (rawTag: string): string | null => {
  const match = /^<\/?\s*([A-Za-z][A-Za-z0-9:-]*)/.exec(rawTag);
  return match?.[1]?.toLowerCase() ?? null;
};

const isSelfClosingTag = (rawTag: string): boolean => {
  let index = rawTag.length - 2;

  while (index >= 0 && /\s/.test(rawTag[index] ?? '')) {
    index -= 1;
  }

  return rawTag[index] === '/';
};

const formatTokens = (tokens: HtmlToken[]): string => {
  let output = '';
  let indentLevel = 0;
  let lastMeaningfulToken: HtmlToken | null = null;

  for (const token of tokens) {
    if (token.kind === 'text') {
      output = appendRaw(output, token.raw, indentLevel);

      if (!isWhitespaceOnly(token.raw)) {
        lastMeaningfulToken = token;
      }

      continue;
    }

    if (token.kind === 'startTag' && isStructuralTag(token.tagName)) {
      output = appendStructuralStart(output, token.raw, indentLevel, lastMeaningfulToken);
      indentLevel += 1;
      lastMeaningfulToken = token;
      continue;
    }

    if (token.kind === 'endTag' && isStructuralTag(token.tagName)) {
      indentLevel = Math.max(indentLevel - 1, 0);
      output = appendStructuralEnd(output, token.raw, indentLevel, lastMeaningfulToken);
      lastMeaningfulToken = token;
      continue;
    }

    if (token.kind === 'rawTextBlock') {
      output = appendStructuralLine(output, token.raw, indentLevel);
      lastMeaningfulToken = token;
      continue;
    }

    output = appendRaw(output, token.raw, indentLevel);
    lastMeaningfulToken = token;
  }

  return output;
};

const appendStructuralStart = (
  output: string,
  raw: string,
  indentLevel: number,
  previousToken: HtmlToken | null
): string => {
  if (output && !endsWithNewline(output) && isAfterStructuralBoundary(previousToken)) {
    output += '\n';
  }

  return appendRaw(output, raw, indentLevel);
};

const appendStructuralEnd = (
  output: string,
  raw: string,
  indentLevel: number,
  previousToken: HtmlToken | null
): string => {
  if (output && !endsWithNewline(output) && isAfterStructuralBoundary(previousToken)) {
    output += '\n';
  }

  return appendRaw(output, raw, indentLevel);
};

const appendStructuralLine = (output: string, raw: string, indentLevel: number): string => {
  if (output && !endsWithNewline(output)) {
    output += '\n';
  }

  return appendRaw(output, raw, indentLevel);
};

const appendRaw = (output: string, raw: string, indentLevel: number): string => {
  if (!raw) {
    return output;
  }

  if (!output || endsWithNewline(output)) {
    return `${output}${INDENT.repeat(indentLevel)}${raw}`;
  }

  return `${output}${raw}`;
};

const isStructuralTag = (tagName: string): boolean => {
  return BLOCK_TAGS.has(tagName) || TABLE_TAGS.has(tagName);
};

const isAfterStructuralBoundary = (token: HtmlToken | null): boolean => {
  if (!token) {
    return false;
  }

  if (
    (token.kind === 'startTag' || token.kind === 'endTag' || token.kind === 'voidTag') &&
    isStructuralTag(token.tagName)
  ) {
    return true;
  }

  return token.kind === 'rawTextBlock' || token.kind === 'comment' || token.kind === 'doctype';
};

const isWhitespaceOnly = (value: string): boolean => {
  return value.trim() === '';
};

const endsWithNewline = (value: string): boolean => {
  return value.endsWith('\n');
};
