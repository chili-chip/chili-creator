// The creator's languages. English text is the key: a string with no
// translation shows as written, so a language can be filled in bit by bit.

export type Catalog = Record<string, string>;
export type Vars = Record<string, string | number>;

export interface Language {
  id: string;
  /** The language's name in itself. */
  name: string;
}

/** The classic editor's languages, with its codes made standard (cze is cs, br is pt-BR). */
export const languages: Language[] = [
  { id: 'en', name: 'English' },
  { id: 'fr', name: 'Français' },
  { id: 'pt', name: 'Português' },
  { id: 'pt-BR', name: 'Português Brasileiro' },
  { id: 'es', name: 'Español' },
  { id: 'it', name: 'Italiano' },
  { id: 'ru', name: 'Русский' },
  { id: 'sv', name: 'Svenska' },
  { id: 'de', name: 'Deutsch' },
  { id: 'ar', name: 'العربية' },
  { id: 'is', name: 'Íslenska' },
  { id: 'hu', name: 'Magyar' },
  { id: 'eo', name: 'Esperanto' },
  { id: 'et', name: 'Eesti' },
  { id: 'zh', name: '简体中文' },
  { id: 'pl', name: 'Polski' },
  { id: 'ja', name: '日本語' },
  { id: 'chn', name: 'Chinuk Wawa' },
  { id: 'cs', name: 'Čeština' },
  { id: 'uk', name: 'Українська' },
];

export const LANGUAGE_KEY = 'chili.creator.language';

const known = (id: string | null | undefined) => languages.find((l) => l.id.toLowerCase() === id?.toLowerCase())?.id;

/** The saved language if there is one, else the first browser language we have, else English. */
export function pickLanguage(saved: string | null, browser: readonly string[]): string {
  const fromSaved = known(saved);
  if (fromSaved) return fromSaved;
  for (const tag of browser) {
    const found = known(tag) ?? known(tag.split('-')[0]);
    if (found) return found;
  }
  return 'en';
}

/** `text` in the catalog's language, with `{name}` filled in from `vars`. */
export function translate(catalog: Catalog | undefined, text: string, vars?: Vars): string {
  const out = catalog?.[text] || text;
  return vars ? out.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole)) : out;
}

const catalogFiles = import.meta.glob<{ default: Catalog }>('./catalogs/*.ts');

async function loadCatalog(id: string): Promise<Catalog> {
  const file = catalogFiles[`./catalogs/${id}.ts`];
  return file ? (await file()).default : {};
}

function saved(): string | null {
  try {
    return localStorage.getItem(LANGUAGE_KEY);
  } catch {
    return null;
  }
}

export interface I18nState {
  language: string;
  catalog: Catalog | undefined;
}

export function createI18n({
  browser = typeof navigator === 'undefined' ? [] : navigator.languages,
  load = loadCatalog,
}: { browser?: readonly string[]; load?: (id: string) => Promise<Catalog> } = {}) {
  let state: I18nState = { language: 'en', catalog: undefined };
  const listeners = new Set<() => void>();

  function show(language: string, catalog: Catalog | undefined) {
    state = { language, catalog };
    document.documentElement.lang = language;
    listeners.forEach((listener) => listener());
  }

  const i18n = {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    t: (text: string, vars?: Vars) => translate(state.catalog, text, vars),
    async setLanguage(id: string) {
      const language = known(id) ?? 'en';
      try {
        localStorage.setItem(LANGUAGE_KEY, language);
      } catch {
        // Blocked storage: the choice lasts this visit.
      }
      show(language, language === 'en' ? undefined : await load(language));
    },
    /** Loads the language people chose before, or their browser's. */
    start() {
      const language = pickLanguage(saved(), browser);
      return language === 'en' ? Promise.resolve() : i18n.setLanguage(language);
    },
  };
  return i18n;
}

export type I18n = ReturnType<typeof createI18n>;
