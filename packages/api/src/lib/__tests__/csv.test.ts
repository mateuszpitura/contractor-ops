import { describe, expect, it } from 'vitest';
import { encodeCsvUtf8Bom, escapeCsvField, UTF8_BOM } from '../csv.js';

// ---------------------------------------------------------------------------
// escapeCsvField
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
});
