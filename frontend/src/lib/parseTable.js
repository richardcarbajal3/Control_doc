// Parse text copied from a spreadsheet (Excel/Sheets) into a matrix of cells.
// Clipboard data is tab-separated, with newlines between rows. Cells that
// contain tabs or newlines are wrapped in double quotes by the spreadsheet, so
// we honor quoting (and the "" escape for a literal quote).
export function parseMatrix(text) {
  const s = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < s.length) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === '\t') { row.push(field); field = ''; i++; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += ch; i++;
  }
  row.push(field);
  rows.push(row);

  // Drop trailing fully-empty rows (a common artifact of trailing newlines).
  while (rows.length && rows[rows.length - 1].every((c) => c.trim() === '')) rows.pop();
  return rows;
}
