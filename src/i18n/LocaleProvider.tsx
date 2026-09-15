/* eslint-disable react-refresh/only-export-components -- useLocale is the provider hook */
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Catalog, Locale } from './catalog';
import {
  detectAccessLocale,
  guessLocaleFromDevice,
  messagesFor,
  readStoredLocale,
  writeStoredLocale,
} from './detectLocale';

type LocaleContextValue = {
  locale: Locale;
  copy: Catalog;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const stored = readStoredLocale();
  const userPicked = useRef(stored != null);
  const [locale, setLocaleState] = useState<Locale>(stored ?? guessLocaleFromDevice());

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    // Only an explicit EN/PT choice is stored, so a later visit can follow a new origin.
    if (userPicked.current) return;
    void detectAccessLocale().then((detected) => {
      if (userPicked.current) return;
      setLocaleState(detected);
    });
  }, []);

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    copy: messagesFor(locale),
    setLocale(next) {
      userPicked.current = true;
      writeStoredLocale(next);
      setLocaleState(next);
    },
  }), [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error('useLocale must be used within LocaleProvider');
  return value;
}
