import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import ta from './locales/ta.json';

export const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'ta', label: 'தமிழ்' },
];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ta: { translation: ta },
    },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'sas_lang',
      caches: ['localStorage'],
    },
  });

// Toggle a class on <body> so CSS can pick fonts per language.
const applyBodyClass = (lng) => {
  document.body.classList.remove('lang-en', 'lang-ta');
  document.body.classList.add(`lang-${lng}`);
  document.documentElement.lang = lng;
};
applyBodyClass(i18n.language || 'en');
i18n.on('languageChanged', applyBodyClass);

export default i18n;
