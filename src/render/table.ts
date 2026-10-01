/** A deterministic, ANSI-free table for output channels and CLI adapters. */
export const renderTable = (columns: string[], rows: Array<Record<string, string | number>>): string => {
  const widths = columns.map((column) =>
    Math.max(column.length, ...rows.map((row) => String(row[column] ?? '').length))
  );
  const line = (row: Record<string, string | number>): string =>
    columns
      .map((column, index) => String(row[column] ?? '').padEnd(widths[index]))
      .join('  ')
      .trimEnd();
  return [
    line(Object.fromEntries(columns.map((column) => [column, column]))),
    widths.map((width) => '-'.repeat(width)).join('  '),
    ...rows.map(line),
  ].join('\n');
};
