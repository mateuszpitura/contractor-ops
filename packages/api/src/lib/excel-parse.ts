/**
 * Parse XLSX / CSV buffers into row objects (header row = keys).
 * Uses exceljs instead of SheetJS (`xlsx`) to avoid known prototype-pollution / ReDoS issues.
 */

import { Readable } from "node:stream";
import type { Cell } from "exceljs";

function cellToDisplayString(cell: Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === "object" && v !== null && "richText" in v) {
    const rt = v as { richText: Array<{ text: string }> };
    return rt.richText.map((x) => x.text).join("");
  }
  if (typeof v === "object" && v !== null && "result" in v) {
    const res = (v as { result: unknown }).result;
    if (res instanceof Date) return res.toISOString().slice(0, 10);
    if (res === null || res === undefined) return "";
    return String(res);
  }
  return String(v);
}

function isRowEmptyStrings(obj: Record<string, string>): boolean {
  return Object.values(obj).every((x) => String(x).trim() === "");
}

/**
 * Read first worksheet as array of plain string records (aligned with prior `sheet_to_json` + defval "").
 */
export async function parseSpreadsheetBuffer(buffer: Buffer): Promise<Record<string, string>[]> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();

  const isZipXlsx = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;

  const nodeBuffer = Buffer.from(buffer);

  if (isZipXlsx) {
    await workbook.xlsx.load(nodeBuffer);
  } else {
    await workbook.csv.read(Readable.from(nodeBuffer), {});
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error("File contains no sheets");
  }

  const headerRow = sheet.getRow(1);
  const colCount = Math.max(headerRow.cellCount, sheet.columnCount ?? 0, 1);
  const headers: string[] = [];
  for (let c = 1; c <= colCount; c++) {
    headers.push(cellToDisplayString(headerRow.getCell(c)));
  }

  const out: Record<string, string>[] = [];
  const lastRow = sheet.rowCount;

  for (let r = 2; r <= lastRow; r++) {
    const row = sheet.getRow(r);
    const obj: Record<string, string> = {};
    for (let c = 1; c <= colCount; c++) {
      const h = headers[c - 1] ?? `Column${c}`;
      obj[h] = cellToDisplayString(row.getCell(c));
    }
    if (!isRowEmptyStrings(obj)) {
      out.push(obj);
    }
  }

  return out;
}
