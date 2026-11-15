/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WINDLOG_URL: string
  readonly VITE_WINDLOG_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Injected by vite.config.ts `define` — ISO timestamp of the build/deploy. */
declare const __BUILD_TIME__: string
/** True when the bundle was built by the GitHub Actions deploy workflow. */
declare const __IS_GITHUB_BUILD__: boolean

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
