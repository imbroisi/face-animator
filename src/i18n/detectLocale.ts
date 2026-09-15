import { catalogs, isLocale, type Locale } from './catalog';

const STORAGE_KEY = 'locale';

const BRAZIL_TIMEZONES = new Set([
  'America/Sao_Paulo',
  'America/Bahia',
  'America/Fortaleza',
  'America/Recife',
  'America/Maceio',
  'America/Araguaina',
  'America/Belem',
  'America/Santarem',
  'America/Manaus',
  'America/Cuiaba',
  'America/Campo_Grande',
  'America/Porto_Velho',
  'America/Boa_Vista',
  'America/Rio_Branco',
  'America/Eirunepe',
  'America/Noronha',
]);

export function readStoredLocale(): Locale | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isLocale(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredLocale(locale: Locale) {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch { /* ignore quota / private mode */ }
}

export function guessLocaleFromDevice(): Locale {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timeZone && BRAZIL_TIMEZONES.has(timeZone)) return 'pt-BR';
  } catch { /* Intl may be unavailable */ }
  return 'en';
}

async function fetchAccessCountry(): Promise<string | null> {
  const abort = new AbortController();
  const timer = window.setTimeout(() => abort.abort(), 2500);
  try {
    const response = await fetch('https://api.country.is/', { signal: abort.signal });
    if (!response.ok) return null;
    const data = await response.json() as { country?: unknown };
    return typeof data.country === 'string' ? data.country : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function detectAccessLocale(): Promise<Locale> {
  // IP country is the access origin. Browser language is ignored so pt-PT
  // and generic Portuguese stay on English unless the request is from Brazil.
  const country = await fetchAccessCountry();
  if (country === 'BR') return 'pt-BR';
  if (country) return 'en';
  return guessLocaleFromDevice();
}

export function messagesFor(locale: Locale) {
  return catalogs[locale];
}
