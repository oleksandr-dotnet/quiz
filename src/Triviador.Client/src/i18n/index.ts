import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './resources/en.json'
import ru from './resources/ru.json'
import type { Language } from '../api/contracts'

const STORAGE_KEY = 'triviador.locale'

export type Locale = 'ru' | 'en'

function storedLocale(): Locale {
  return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'ru'
}

void i18next.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    en: { translation: en },
  },
  lng: storedLocale(),
  fallbackLng: 'ru',
  keySeparator: false,
  interpolation: { escapeValue: false },
})

// Persists the visitor's own choice from the landing screen, before any room exists.
export function setLocalePreference(locale: Locale): void {
  localStorage.setItem(STORAGE_KEY, locale)
  void i18next.changeLanguage(locale)
}

export function localeOf(language: Language): Locale {
  return language === 'English' ? 'en' : 'ru'
}

// Once a room is joined, its fixed Language always wins over the pre-room preference - every
// player in the room sees the same chrome language, matching the shared question/region content.
export function applyRoomLanguage(language: Language): void {
  void i18next.changeLanguage(localeOf(language))
}

export default i18next
