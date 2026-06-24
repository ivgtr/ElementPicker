import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const createMarkdownService = (): TurndownService => {
  const service = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
  });

  service.use(gfm);
  service.addRule('elementPickerParagraphBreak', {
    filter: (node) => node.nodeName === 'BR' && isInConsecutiveBreakRun(node),
    replacement: (_content, node) => {
      return isFirstBreakInRun(node) ? '\n\n' : '';
    },
  });
  service.addRule('elementPickerInlineLink', {
    filter: 'a',
    replacement: (content, node) => {
      return linkToMarkdown(node as HTMLAnchorElement, content);
    },
  });
  service.addRule('elementPickerTable', {
    filter: 'table',
    replacement: (_content, node) => {
      return tableToMarkdown(node as HTMLTableElement, service);
    },
  });
  service.addRule('elementPickerTableSection', {
    filter: ['thead', 'tbody', 'tfoot'],
    replacement: (_content, node) => {
      return tableRowsToMarkdown(Array.from((node as HTMLTableSectionElement).rows), service);
    },
  });
  service.addRule('elementPickerTableRow', {
    filter: 'tr',
    replacement: (_content, node) => {
      return tableRowsToMarkdown([node as HTMLTableRowElement], service);
    },
  });

  return service;
};

const markdownService = createMarkdownService();

export const htmlToMarkdown = (input: string | HTMLElement): string => {
  return markdownService.turndown(input).trim();
};

const tableToMarkdown = (table: HTMLTableElement, service: TurndownService): string => {
  return tableRowsToMarkdown(Array.from(table.rows), service, table);
};

const tableRowsToMarkdown = (
  tableRows: HTMLTableRowElement[],
  service: TurndownService,
  table?: HTMLTableElement
): string => {
  const rows = tableRows.map((row) => Array.from(row.cells)).filter((cells) => cells.length > 0);

  if (rows.length === 0) {
    return '';
  }

  const markdownRows = rows.map((cells) =>
    cells.flatMap((cell) => {
      const content = cellToMarkdown(cell, service);
      const span = Math.max(cell.colSpan, 1);
      return [content, ...Array<string>(span - 1).fill('')];
    })
  );

  const columnCount = Math.max(...markdownRows.map((row) => row.length));
  const hasExplicitHeader = isExplicitHeaderRow(rows[0], table);
  const header = hasExplicitHeader
    ? padRow(markdownRows[0], columnCount)
    : createGeneratedHeader(columnCount);
  const bodyRows = hasExplicitHeader ? markdownRows.slice(1) : markdownRows;
  const separator = createSeparatorRow(hasExplicitHeader ? rows[0] : [], columnCount);

  const caption = table?.caption ? service.turndown(table.caption.innerHTML).trim() : '';
  const markdownTable = [header, separator, ...bodyRows.map((row) => padRow(row, columnCount))]
    .map(formatTableRow)
    .join('\n');

  return `\n\n${[caption, markdownTable].filter(Boolean).join('\n\n')}\n\n`;
};

const isExplicitHeaderRow = (
  cells: HTMLTableCellElement[],
  table?: HTMLTableElement
): boolean => {
  if (cells.length === 0) {
    return false;
  }

  const firstTableRow = cells[0].parentElement;
  return table?.tHead?.rows[0] === firstTableRow || cells.some((cell) => cell.tagName === 'TH');
};

const cellToMarkdown = (cell: HTMLTableCellElement, service: TurndownService): string => {
  return service
    .turndown(cell.innerHTML)
    .replace(/\s*\n+\s*/g, '<br>')
    .replace(/\|/g, '\\|')
    .trim();
};

const createGeneratedHeader = (columnCount: number): string[] => {
  return Array.from({ length: columnCount }, (_value, index) => `Column ${index + 1}`);
};

const createSeparatorRow = (headerCells: HTMLTableCellElement[], columnCount: number): string[] => {
  const alignments = headerCells.flatMap((cell) => {
    const separator = separatorForAlignment(cell.getAttribute('align') || cell.style.textAlign);
    const span = Math.max(cell.colSpan, 1);
    return [separator, ...Array<string>(span - 1).fill('---')];
  });

  return padRow(alignments, columnCount, '---');
};

const separatorForAlignment = (alignment: string): string => {
  switch (alignment.toLowerCase()) {
    case 'left':
      return ':---';
    case 'center':
      return ':---:';
    case 'right':
      return '---:';
    default:
      return '---';
  }
};

const padRow = (row: string[], columnCount: number, fill = ''): string[] => {
  return [...row, ...Array<string>(Math.max(columnCount - row.length, 0)).fill(fill)];
};

const formatTableRow = (row: string[]): string => {
  return `| ${row.join(' | ')} |`;
};

const linkToMarkdown = (anchor: HTMLAnchorElement, content: string): string => {
  const href = anchor.getAttribute('href')?.trim() ?? '';
  const label = normalizeInlineMarkdown(content);

  if (!href) {
    return label;
  }

  if (!label) {
    return href;
  }

  const title = anchor.getAttribute('title')?.trim();
  const titlePart = title ? ` "${title.replace(/"/g, '\\"')}"` : '';

  return `[${label}](${escapeLinkDestination(href)}${titlePart})`;
};

const normalizeInlineMarkdown = (content: string): string => {
  return content
    .trim()
    .replace(/[ \t]*\n+[ \t]*/g, ' ')
    .replace(/[ \t]{2,}/g, ' ');
};

const escapeLinkDestination = (href: string): string => {
  if (/\s/.test(href)) {
    return `<${href.replace(/\\/g, '\\\\').replace(/>/g, '\\>')}>`;
  }

  return href.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
};

const isInConsecutiveBreakRun = (node: Node): boolean => {
  return (
    previousMeaningfulSibling(node)?.nodeName === 'BR' ||
    nextMeaningfulSibling(node)?.nodeName === 'BR'
  );
};

const isFirstBreakInRun = (node: Node): boolean => {
  return (
    previousMeaningfulSibling(node)?.nodeName !== 'BR' &&
    nextMeaningfulSibling(node)?.nodeName === 'BR'
  );
};

const previousMeaningfulSibling = (node: Node): Node | null => {
  let sibling = node.previousSibling;

  while (sibling && isWhitespaceText(sibling)) {
    sibling = sibling.previousSibling;
  }

  return sibling;
};

const nextMeaningfulSibling = (node: Node): Node | null => {
  let sibling = node.nextSibling;

  while (sibling && isWhitespaceText(sibling)) {
    sibling = sibling.nextSibling;
  }

  return sibling;
};

const isWhitespaceText = (node: Node): boolean => {
  return node.nodeType === 3 && node.textContent?.trim() === '';
};
