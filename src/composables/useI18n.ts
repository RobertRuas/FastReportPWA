import { computed } from 'vue'
import { useSettings } from './useSettings'
import pt from '@/i18n/pt'
import en from '@/i18n/en'

const dictionaries: Record<string, Record<string, string>> = { pt, en }

function detectLang(): 'pt' | 'en' {
  const nav = navigator.languages?.[0] ?? navigator.language ?? ''
  return nav.startsWith('pt') ? 'pt' : 'en'
}

export function useI18n() {
  const { settings } = useSettings()

  const lang = computed<'pt' | 'en'>(() => {
    if (settings.langPref === 'pt' || settings.langPref === 'en') return settings.langPref
    return detectLang()
  })

  function t(key: string, vars?: Record<string, string | number>): string {
    let str = dictionaries[lang.value]?.[key]
      ?? dictionaries[lang.value === 'pt' ? 'en' : 'pt']?.[key]
      ?? key

    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(`{${k}}`, String(v))
      }
    }
    return str
  }

  return { t, lang }
}
