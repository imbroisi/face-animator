import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useLocale } from '../../../i18n/LocaleProvider';
import type { Locale } from '../../../i18n/catalog';

export function LocaleSwitcher() {
  const { locale, copy, setLocale } = useLocale();

  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={locale}
      onChange={(_, next: Locale | null) => {
        if (next) setLocale(next);
      }}
      aria-label={copy.language}
      sx={{ flexShrink: 0 }}
    >
      <ToggleButton value="en" aria-label={copy.languageEnglish}>{copy.languageEn}</ToggleButton>
      <ToggleButton value="pt-BR" aria-label={copy.languagePortuguese}>
        {copy.languagePtBr}
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
