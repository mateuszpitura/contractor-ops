import { describe, expect, it } from 'vitest';
import { transliterateToBacs } from '../ascii-transliterate.js';

describe('transliterateToBacs', () => {
  describe('European diacritics', () => {
    it('transliterates German umlauts (Müller -> MULLER)', () => {
      expect(transliterateToBacs('Müller')).toEqual({ output: 'MULLER', replaced: [] });
    });

    it('transliterates German eszett (Straße -> STRASSE)', () => {
      expect(transliterateToBacs('Straße')).toEqual({ output: 'STRASSE', replaced: [] });
    });

    it('transliterates Polish letters (Łódzki -> LODZKI)', () => {
      expect(transliterateToBacs('Łódzki')).toEqual({ output: 'LODZKI', replaced: [] });
    });

    it('transliterates French accents (café -> CAFE)', () => {
      expect(transliterateToBacs('café')).toEqual({ output: 'CAFE', replaced: [] });
    });

    it('transliterates each Polish lowercase letter to its mapped uppercase ASCII', () => {
      expect(transliterateToBacs('ąćęłńóśźż')).toEqual({
        output: 'ACELNOSZZ',
        replaced: [],
      });
    });

    it('transliterates each Polish uppercase letter to its mapped uppercase ASCII', () => {
      expect(transliterateToBacs('ĄĆĘŁŃÓŚŹŻ')).toEqual({
        output: 'ACELNOSZZ',
        replaced: [],
      });
    });

    it('transliterates German diacritics (ä, ö, ü, ß)', () => {
      expect(transliterateToBacs('äöüß')).toEqual({ output: 'AOUSS', replaced: [] });
      expect(transliterateToBacs('ÄÖÜ')).toEqual({ output: 'AOU', replaced: [] });
    });

    it('transliterates French e-variants (é, è, ê, ë)', () => {
      expect(transliterateToBacs('éèêë')).toEqual({ output: 'EEEE', replaced: [] });
    });

    it('transliterates French a-variants (á, à, â) and ç', () => {
      expect(transliterateToBacs('áàâç')).toEqual({ output: 'AAAC', replaced: [] });
    });

    it('transliterates Nordic ø and å', () => {
      expect(transliterateToBacs('øå')).toEqual({ output: 'OA', replaced: [] });
      expect(transliterateToBacs('ØÅ')).toEqual({ output: 'OA', replaced: [] });
    });

    it('transliterates Italian/Spanish ñ, í, ú', () => {
      expect(transliterateToBacs('ñíú')).toEqual({ output: 'NIU', replaced: [] });
    });
  });

  describe('BACS-allowed characters', () => {
    it('uppercases plain ASCII letters', () => {
      expect(transliterateToBacs('Hello World')).toEqual({
        output: 'HELLO WORLD',
        replaced: [],
      });
    });

    it('preserves digits unchanged', () => {
      expect(transliterateToBacs('1234567890')).toEqual({
        output: '1234567890',
        replaced: [],
      });
    });

    it("preserves apostrophes (O'Brien)", () => {
      expect(transliterateToBacs("O'Brien")).toEqual({ output: "O'BRIEN", replaced: [] });
    });

    it('preserves all 14 BACS-allowed punctuation characters unchanged', () => {
      // BACS allowed punctuation per D-05: - . ' / & ( ) + , : ; ? = " @
      expect(transliterateToBacs('-.\'/+&():;?="@,')).toEqual({
        output: '-.\'/+&():;?="@,',
        replaced: [],
      });
    });

    it('preserves space character', () => {
      expect(transliterateToBacs('A B C')).toEqual({ output: 'A B C', replaced: [] });
    });

    it('returns empty result for empty input', () => {
      expect(transliterateToBacs('')).toEqual({ output: '', replaced: [] });
    });
  });

  describe('unmappable characters', () => {
    it('replaces CJK characters with ? and tracks them', () => {
      expect(transliterateToBacs('日本語')).toEqual({
        output: '???',
        replaced: ['日', '本', '語'],
      });
    });

    it('replaces Arabic characters with ? and tracks them', () => {
      const result = transliterateToBacs('مرحبا');
      expect(result.output).toBe('?????');
      expect(result.replaced).toEqual(['م', 'ر', 'ح', 'ب', 'ا']);
    });

    it('replaces emoji with ? and tracks them', () => {
      const result = transliterateToBacs('Hi 🎉');
      expect(result.output).toBe('HI ?');
      expect(result.replaced).toContain('🎉');
    });

    it('mixes mappable and unmappable correctly', () => {
      const result = transliterateToBacs('Café日本');
      expect(result.output).toBe('CAFE??');
      expect(result.replaced).toEqual(['日', '本']);
    });

    it('does NOT replace BACS-disallowed ASCII punctuation (e.g., underscore, hash, dollar)', () => {
      // Underscore, hash, dollar, percent are NOT in the BACS character set
      const result = transliterateToBacs('a_b#c$d%');
      expect(result.output).toBe('A?B?C?D?');
      expect(result.replaced).toEqual(['_', '#', '$', '%']);
    });
  });

  describe('real-world contractor names', () => {
    it('handles a typical Polish-British mixed name', () => {
      expect(transliterateToBacs('Łukasz Żółkowski')).toEqual({
        output: 'LUKASZ ZOLKOWSKI',
        replaced: [],
      });
    });

    it('handles a French-Canadian name with accents and apostrophe', () => {
      expect(transliterateToBacs("D'Anjou-Côté")).toEqual({
        output: "D'ANJOU-COTE",
        replaced: [],
      });
    });

    it('handles a German company name with eszett', () => {
      expect(transliterateToBacs('Müßig & Söhne GmbH')).toEqual({
        output: 'MUSSIG & SOHNE GMBH',
        replaced: [],
      });
    });
  });
});
