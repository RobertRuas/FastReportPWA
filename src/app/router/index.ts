import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

export interface PageAction {
  icon: string
  label: string
  handler?: () => void
}

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    isHome?: boolean
    fullscreen?: boolean
    fallbackRoute?: string
    public?: boolean
    actions?: PageAction[]
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/auth',
    name: 'auth',
    component: () => import('@/pages/Auth/AuthPage.vue'),
    meta: {
      title: 'Autenticação',
      fullscreen: true,
      public: true
    }
  },
  {
    path: '/',
    name: 'home',
    component: () => import('@/pages/Home/HomePage.vue'),
    meta: {
      title: 'FastReport PWA',
      isHome: true
    }
  },
  {
    path: '/projects/new',
    name: 'new-project',
    component: () => import('@/pages/NewProject/NewProjectPage.vue'),
    meta: {
      title: 'Novo Projeto',
      fallbackRoute: '/'
    }
  },
  {
    path: '/projects/:id',
    name: 'project-details',
    component: () => import('@/pages/ProjectDetails/ProjectDetailsPage.vue'),
    meta: {
      title: 'Projeto',
      fallbackRoute: '/'
    }
  },
  {
    path: '/projects/:id/review',
    name: 'project-review',
    component: () => import('@/pages/ProjectReview/ProjectReviewPage.vue'),
    meta: {
      title: 'Review',
      fallbackRoute: '/'
    }
  },
  {
    path: '/projects/:id/triage',
    name: 'triage',
    component: () => import('@/pages/PhotoViewer/PhotoViewerPage.vue'),
    meta: {
      title: 'Triagem',
      fullscreen: true,
      fallbackRoute: '/'
    }
  },
{
    path: '/maps',
    name: 'maps',
    component: () => import('@/pages/Maps/MapsPage.vue'),
    meta: {
      title: 'Mapas',
      fallbackRoute: '/'
    }
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/pages/Settings/SettingsPage.vue'),
    meta: {
      title: 'Definições',
      fallbackRoute: '/'
    }
  }
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach(async (to) => {
  if (to.meta.public) return true
  try {
    const { check, authenticated } = useAuth()
    if (!authenticated.value) {
      const ok = await check()
      if (!ok) return { name: 'auth' }
    }
  } catch {
    return { name: 'auth' }
  }
  return true
})
