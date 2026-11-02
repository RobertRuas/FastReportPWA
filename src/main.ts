import { createApp } from 'vue'
import PrimeVue from 'primevue/config'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'
import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'
import 'primeicons/primeicons.css'
import './styles/global.css'
import './styles/primevue.css'
import App from './App.vue'
import { router } from './app/router'

const AppPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
      950: '#030712'
    }
  }
})

const app = createApp(App)

app.use(router)
app.use(PrimeVue, {
  theme: {
    preset: AppPreset,
    options: {
      darkModeSelector: '.dark-mode'
    }
  }
})
app.use(ConfirmationService)
app.use(ToastService)

app.mount('#app')

if (typeof (window as any).__splashReady === 'function') {
  (window as any).__splashReady()
}

document.addEventListener('gesturestart', e => e.preventDefault())
document.addEventListener('gesturechange', e => e.preventDefault())
