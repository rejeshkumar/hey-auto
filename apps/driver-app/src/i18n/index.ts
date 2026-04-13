import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { storage } from '../utils/storage';
import ml from './ml';
import en from './en';

const savedLang = storage.getString('language') || 'ml';

i18n.use(initReactI18next).init({
  resources: {
    ml: { translation: ml },
    en: { translation: en },
  },
  lng: savedLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
