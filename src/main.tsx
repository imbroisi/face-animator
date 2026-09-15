import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/App';
import { LocaleProvider } from './i18n/LocaleProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleProvider>
      <App />
    </LocaleProvider>
  </StrictMode>,
);
