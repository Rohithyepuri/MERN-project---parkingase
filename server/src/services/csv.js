function cell(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(rows, columns) {
  const header = columns.map((c) => cell(c.label)).join(',');
  const lines = rows.map((row) => columns.map((c) => cell(row[c.key])).join(','));
  return `${[header, ...lines].join('\r\n')}\r\n`;
}

export function sendCsv(res, filename, csv) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}
