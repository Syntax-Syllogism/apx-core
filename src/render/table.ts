const headerText = (column: string): string =>
  column
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

/**
 * A deterministic, ANSI-free table for output channels and CLI adapters. Reproduces the layout of oclif's
 * `ux.table`: a box-drawn border, one space of cell padding, left-aligned cells and Title Case headers.
 */
export const renderTable = (columns: string[], rows: Array<Record<string, string | number>>): string => {
  const headers = columns.map(headerText);
  const cells = rows.map((row) => columns.map((column) => String(row[column] ?? '')));
  const widths = headers.map((header, index) => Math.max(header.length, ...cells.map((row) => row[index].length)));
  const border = (left: string, join: string, right: string): string =>
    left + widths.map((width) => '─'.repeat(width + 2)).join(join) + right;
  const line = (values: string[]): string =>
    `│${values.map((value, index) => ` ${value.padEnd(widths[index])} `).join('│')}│`;
  return [border('┌', '┬', '┐'), line(headers), border('├', '┼', '┤'), ...cells.map(line), border('└', '┴', '┘')].join(
    '\n'
  );
};
