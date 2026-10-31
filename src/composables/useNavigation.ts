import { useRouter, useRoute } from 'vue-router'

export function useNavigation() {
  const router = useRouter()
  const route = useRoute()

  function goBack() {
    const fallback = (route.meta.fallbackRoute as string) ?? '/'
    if (window.history.state?.back) {
      router.back()
    } else {
      router.replace(fallback)
    }
  }

  return { goBack }
}
