import { catalogText, type Catalog, type StringKey } from './catalog';

export function translateThrown(
  copy: Catalog,
  error: unknown,
  fallback: StringKey,
) {
  if (error instanceof Error) {
    const mapped = catalogText(copy, error.message);
    if (mapped) return mapped;
    if (error.message) return error.message;
  }
  return copy[fallback];
}
