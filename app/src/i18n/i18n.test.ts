import { describe, expect, it } from 'vitest';
import { createI18n, LANGUAGE_KEY, languages, pickLanguage, translate, type Catalog } from '.';

describe('translate', () => {
  it('uses the catalog, falls back to English, and fills in names', () => {
    const catalog = { 'Play game': 'Zagraj', 'Delete “{name}”?': 'Usunąć „{name}”?' };
    expect(translate(catalog, 'Play game')).toBe('Zagraj');
    expect(translate(catalog, 'Stop')).toBe('Stop');
    expect(translate(catalog, 'Delete “{name}”?', { name: 'cat' })).toBe('Usunąć „cat”?');
    expect(translate(undefined, '{n} of {max}', { n: 3, max: 30 })).toBe('3 of 30');
  });
});

describe('pickLanguage', () => {
  it('takes the saved language, else the browser’s, else English', () => {
    expect(pickLanguage('pl', ['de-DE'])).toBe('pl');
    expect(pickLanguage(null, ['xx', 'de-DE'])).toBe('de');
    expect(pickLanguage('nope', ['zz'])).toBe('en');
  });

  it('knows every classic editor language, each named in itself', () => {
    expect(languages.map((l) => l.id)).toEqual(
      expect.arrayContaining(['en', 'fr', 'pt', 'es', 'it', 'ru', 'sv', 'de', 'ar', 'is', 'hu', 'eo', 'et', 'zh', 'pl', 'ja', 'cs', 'uk']),
    );
    expect(languages.find((l) => l.id === 'pl')!.name).toBe('Polski');
  });
});

describe('createI18n', () => {
  it('loads a language, remembers it and tells listeners', async () => {
    localStorage.removeItem(LANGUAGE_KEY);
    const i18n = createI18n({ browser: ['en-GB'], load: async (id): Promise<Catalog> => (id === 'pl' ? { Stop: 'Zatrzymaj' } : {}) });
    expect(i18n.getState().language).toBe('en');
    let calls = 0;
    i18n.subscribe(() => calls++);
    await i18n.setLanguage('pl');
    expect(i18n.getState().language).toBe('pl');
    expect(i18n.t('Stop')).toBe('Zatrzymaj');
    expect(localStorage.getItem(LANGUAGE_KEY)).toBe('pl');
    expect(document.documentElement.lang).toBe('pl');
    expect(calls).toBeGreaterThan(0);
  });
});
