// Shared CSV buffer builder — the exceljs + UTF-8 BOM idiom used by every CSV
// payroll export profile. exceljs handles escaping/encoding; we prepend the BOM
// (Excel/vendor compatibility) and end with a trailing newline.

export type CsvDelimiter = ';' | ',';

/**
 * Build a CSV file buffer from a header row + string-array rows.
 * Values are written verbatim (exceljs quotes only when a value contains the
 * delimiter, a quote, or a newline).
 */
export async function toCsvBuffer(
  headers: string[],
  rows: string[][],
  delimiter: CsvDelimiter,
): Promise<Buffer> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Export');
  worksheet.columns = headers.map(header => ({ header }));
  for (const row of rows) {
    worksheet.addRow(row);
  }
  const csv = Buffer.from(await workbook.csv.writeBuffer({ formatterOptions: { delimiter } }));
  const bom = Buffer.from([0xef, 0xbb, 0xbf]);
  return Buffer.concat([bom, csv, Buffer.from('\n')]);
}
