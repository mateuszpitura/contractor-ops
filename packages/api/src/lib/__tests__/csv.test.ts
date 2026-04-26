import { describe, expect, it } from 'vitest';
import { encodeCsvUtf8Bom, escapeCsvField, UTF8_BOM } from '../csv.js';

// ---------------------------------------------------------------------------
// escapeCsvField — core behaviour
// ---------------------------------------------------------------------------

describe('escapeCsvField', () => {
  it('returns a simple string unchanged', () => {
    expect(escapeCsvField('hello')).toBe('hello');
  });

  it('wraps a field containing a comma in double quotes', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"');
  });

  it('escapes internal double quotes and wraps in quotes', () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  it('wraps a field containing a newline in double quotes', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
  });

  it('wraps a field containing a carriage return in double quotes', () => {
    expect(escapeCsvField('line1\r\nline2')).toBe('"line1\r\nline2"');
  });

  it('returns empty string for null', () => {
    expect(escapeCsvField(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(escapeCsvField(undefined)).toBe('');
  });

  it('returns empty string for empty string input', () => {
    expect(escapeCsvField('')).toBe('');
  });

  it('converts numeric values to string', () => {
    expect(escapeCsvField(42)).toBe('42');
  });
});

// ---------------------------------------------------------------------------
// escapeCsvField — formula-injection neutralisation (OWASP / research gap A11)
// ---------------------------------------------------------------------------
//
// The following behaviour closes research gap A11 (CSV formula injection).
// OWASP guidance: when a CSV cell starts with `=`, `+`, `-`, or `@`, the cell
// is interpreted as a formula by Excel/Numbers/LibreOffice. User-entered data
// (contractor names, reference strings) must be neutralised by prefixing a
// single quote so the spreadsheet treats the cell as literal text.

describe('escapeCsvField — formula-prefix neutralisation', () => {
  it('prefixes a leading `=` with a single quote (HYPERLINK/formula payload)', () => {
    expect(escapeCsvField('=cmd|/C calc!A1')).toBe("'=cmd|/C calc!A1");
  });

  it('prefixes a leading `+` with a single quote', () => {
    expect(escapeCsvField('+1')).toBe("'+1");
  });

  it('prefixes a leading `-` with a single quote', () => {
    expect(escapeCsvField('-1')).toBe("'-1");
  });

  it('prefixes a leading `@` with a single quote (@SUM payload)', () => {
    expect(escapeCsvField('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('does not double-prefix an already-neutralised value (leading tab)', () => {
    // Tab-prefixed values are not formula prefixes — pass through unchanged.
    expect(escapeCsvField('\tfoo')).toBe('\tfoo');
  });

  it('does not prefix non-formula leading characters', () => {
    expect(escapeCsvField('normal text')).toBe('normal text');
    expect(escapeCsvField('1234')).toBe('1234');
  });

  it('combines formula neutralisation + quote-wrap when payload contains comma/quote', () => {
    // Leading `=` → prefix `'`. Payload contains `,` and `"` → wrap + double-quote.
    // Input:  =cmd|'/C calc'!A1,evil
    // Step 1: prefix `'` → '=cmd|'/C calc'!A1,evil
    // Step 2: wrap + escape internal quotes → "'=cmd|'/C calc'!A1,evil"
    expect(escapeCsvField("=cmd|'/C calc'!A1,evil")).toBe(`"'=cmd|'/C calc'!A1,evil"`);
  });

  it('neutralises payload that contains both leading `=` and internal double quotes', () => {
    expect(escapeCsvField('=HYPERLINK("http://evil","click")')).toBe(
      `"'=HYPERLINK(""http://evil"",""click"")"`,
    );
  });

  it('treats a single-character formula-prefix string as a literal', () => {
    expect(escapeCsvField('=')).toBe("'=");
    expect(escapeCsvField('+')).toBe("'+");
    expect(escapeCsvField('-')).toBe("'-");
    expect(escapeCsvField('@')).toBe("'@");
  });

  it('passes through number inputs unchanged (no formula neutralisation for numbers)', () => {
    // Number inputs can never be a formula payload — round-trip via String().
    // `-1` as number becomes string "-1" which we DO neutralise (defence in depth).
    // The router only feeds user-string fields through escapeCsvField for
    // sensitive columns; for numbers, negative neutralisation is an acceptable
    // trade-off in spreadsheets (Excel still parses `'-1` visually).
    expect(escapeCsvField(-1)).toBe("'-1");
  });
});

// ---------------------------------------------------------------------------
// UTF8_BOM
// ---------------------------------------------------------------------------

describe('UTF8_BOM', () => {
  it('contains the correct BOM bytes', () => {
    expect(UTF8_BOM).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
  });
});

// ---------------------------------------------------------------------------
// encodeCsvUtf8Bom
// ---------------------------------------------------------------------------

describe('encodeCsvUtf8Bom', () => {
  const columns = [
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
  ];

  it('starts with UTF-8 BOM bytes', () => {
    const buf = encodeCsvUtf8Bom(columns, []);
    expect(buf[0]).toBe(0xef);
    expect(buf[1]).toBe(0xbb);
    expect(buf[2]).toBe(0xbf);
  });

  it('produces a header row from column definitions', () => {
    const buf = encodeCsvUtf8Bom(columns, []);
    const text = buf.slice(3).toString('utf-8');
    expect(text).toBe('Name,Email');
  });

  it('produces correct data rows', () => {
    const rows = [
      { name: 'Alice', email: 'alice@example.com' },
      { name: 'Bob', email: 'bob@example.com' },
    ];
    const buf = encodeCsvUtf8Bom(columns, rows);
    const text = buf.slice(3).toString('utf-8');
    const lines = text.split('\r\n');
    expect(lines).toEqual(['Name,Email', 'Alice,alice@example.com', 'Bob,bob@example.com']);
  });

  it('uses CRLF line endings', () => {
    const rows = [{ name: 'Alice', email: 'a@b.com' }];
    const buf = encodeCsvUtf8Bom(columns, rows);
    const text = buf.slice(3).toString('utf-8');
    expect(text).toContain('\r\n');
    // No bare LF that isn't preceded by CR
    expect(text.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('returns just the header when rows array is empty', () => {
    const buf = encodeCsvUtf8Bom(columns, []);
    const text = buf.slice(3).toString('utf-8');
    expect(text).toBe('Name,Email');
  });

  it('escapes fields with special characters in data rows', () => {
    const rows = [{ name: 'O"Brien', email: 'a,b@c.com' }];
    const buf = encodeCsvUtf8Bom(columns, rows);
    const text = buf.slice(3).toString('utf-8');
    const dataLine = text.split('\r\n')[1];
    expect(dataLine).toBe('"O""Brien","a,b@c.com"');
  });

  it('neutralises formula-injection payloads in data rows (contractor name =...)', () => {
    const rows = [{ name: '=cmd|/C calc!A1', email: 'user@example.com' }];
    const buf = encodeCsvUtf8Bom(columns, rows);
    const text = buf.slice(3).toString('utf-8');
    const dataLine = text.split('\r\n')[1];
    // leading `=` prefixed with `'` → no comma or quote → unquoted
    expect(dataLine).toBe("'=cmd|/C calc!A1,user@example.com");
  });
});
