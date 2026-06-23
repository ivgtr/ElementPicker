import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const createMarkdownService = (): TurndownService => {
  const service = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
  });

  service.use(gfm);
  service.addRule('elementPickerTable', {
    filter: 'table',
    replacement: (_content, node) => {
      return tableToMarkdown(node as HTMLTableElement, service);
    },
  });

  return service;
};

const markdownService = createMarkdownService();

export const htmlToMarkdown = (html: string): string => {
  return markdownService.turndown(html).trim();
};

const tableToMarkdown = (table: HTMLTableElement, service: TurndownService): string => {
  const rows = Array.from(table.rows)
    .map((row) => Array.from(row.cells))
    .filter((cells) => cells.length > 0);

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

  const caption = table.caption ? service.turndown(table.caption.innerHTML).trim() : '';
  const markdownTable = [header, separator, ...bodyRows.map((row) => padRow(row, columnCount))]
    .map(formatTableRow)
    .join('\n');

  return `\n\n${[caption, markdownTable].filter(Boolean).join('\n\n')}\n\n`;
};

const isExplicitHeaderRow = (cells: HTMLTableCellElement[], table: HTMLTableElement): boolean => {
  if (cells.length === 0) {
    return false;
  }

  const firstTableRow = cells[0].parentElement;
  return table.tHead?.rows[0] === firstTableRow || cells.some((cell) => cell.tagName === 'TH');
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
