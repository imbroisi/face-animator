const STORAGE_KEY = 'face-animator-visited';

export function hasVisitedApp() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markAppVisited() {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch { /* ignore quota / private mode */ }
}

export function shouldShowWelcome() {
  if (import.meta.env.DEV) return true;
  return !hasVisitedApp();
}

export function rememberWelcomeSeen() {
  if (import.meta.env.DEV) return;
  markAppVisited();
}
