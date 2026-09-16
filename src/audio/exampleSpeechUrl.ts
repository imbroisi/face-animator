import type { Locale } from '../i18n/catalog';

const EXAMPLE_SPEECH_FILE: Record<Locale, string> = {
  en: 'example-en.mp3',
  'pt-BR': 'exemplo-pt-br.mp3',
};

export function exampleSpeechUrl(locale: Locale) {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return new URL(EXAMPLE_SPEECH_FILE[locale], `${window.location.origin}${base}`).href;
}
