import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Guards the two things that silently break localization:
// 1. en/uk drifting apart (a key added to one language only),
// 2. Ukrainian plural keys missing _few/_many — i18next then falls back to
//    English for counts like 2-4 and 5-20 even in the uk locale.

const I18N_DIR = path.resolve(__dirname, '../../src/i18n');
const LANGS = ['en', 'uk'] as const;

const namespaces = fs
  .readdirSync(path.join(I18N_DIR, 'en'))
  .filter(f => f.endsWith('.json'))
  .map(f => f.replace('.json', ''));

const readNs = (lang: string, ns: string): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(path.join(I18N_DIR, lang, `${ns}.json`), 'utf-8'));

const flattenKeys = (obj: Record<string, unknown>, prefix = ''): string[] =>
  Object.entries(obj).flatMap(([k, v]) =>
    v !== null && typeof v === 'object'
      ? flattenKeys(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );

const PLURAL_SUFFIXES = ['zero', 'one', 'two', 'few', 'many', 'other'];
const pluralBase = (key: string): string | null => {
  const m = key.match(/^(.*)_(zero|one|two|few|many|other)$/);
  return m ? m[1] : null;
};

// Intl.PluralRules cardinal categories actually used by i18next per language.
const REQUIRED_PLURALS: Record<(typeof LANGS)[number], string[]> = {
  en: ['one', 'other'],
  uk: ['one', 'few', 'many', 'other'],
};

describe('i18n parity', () => {
  it('en and uk ship the same namespaces', () => {
    for (const lang of LANGS) {
      const files = fs
        .readdirSync(path.join(I18N_DIR, lang))
        .filter(f => f.endsWith('.json'))
        .sort();
      expect(files, `namespaces for ${lang}`).toEqual(
        namespaces.map(ns => `${ns}.json`).sort(),
      );
    }
  });

  for (const ns of namespaces) {
    it(`${ns}: en and uk have identical key sets (modulo plural forms)`, () => {
      // Plural keys collapse to their base — uk legitimately has more forms.
      const normalize = (keys: string[]) =>
        [...new Set(keys.map(k => pluralBase(k) ?? k))].sort();
      expect(normalize(flattenKeys(readNs('uk', ns)))).toEqual(
        normalize(flattenKeys(readNs('en', ns))),
      );
    });

    for (const lang of LANGS) {
      it(`${ns}: ${lang} plural keys carry every required form`, () => {
        const keys = flattenKeys(readNs(lang, ns));
        const present = new Map<string, Set<string>>();
        for (const key of keys) {
          const base = pluralBase(key);
          if (!base) continue;
          if (!present.has(base)) present.set(base, new Set());
          present.get(base)!.add(key.slice(base.length + 1));
        }
        for (const [base, forms] of present) {
          for (const required of REQUIRED_PLURALS[lang]) {
            expect(
              forms.has(required),
              `${lang}/${ns}: "${base}" is missing "_${required}" (has: ${[...forms].join(', ')})`,
            ).toBe(true);
          }
          for (const form of forms) {
            expect(PLURAL_SUFFIXES, `${lang}/${ns}: unknown plural suffix on "${base}_${form}"`).toContain(form);
          }
        }
      });
    }
  }
});
