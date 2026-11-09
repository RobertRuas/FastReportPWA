# FastReport PWA — File & Directory Map

> Reference for AI agents. Every file and directory in this project with its exact purpose, contents, and relationships.

## Project Overview

- **What**: Mobile-first PWA for capture, triage, review and export of photographic inspection reports. Works offline — data lives in IndexedDB on the device; Supabase is used only for auth, settings sync, remote backups and short-lived download links.
- **Stack**: Vue 3 + TypeScript, PrimeVue 4 (Aura preset), Vue Router (hash history), IndexedDB, Supabase (auth + Postgres + Storage + Edge Functions), Vite 6, `vite-plugin-pwa` (Workbox autoUpdate).
- **Target**: Mobile browsers (installable as PWA). Deployed as a static site to GitHub Pages at https://robertruas.github.io/FastReportPWA/.
- **Languages**: Portuguese + English, auto-detected from `navigator.language`.
- **Access model**: Auth via Supabase email OTP; access gate backed by the `fr_access` table (admin = 92ruas@gmail.com, hard-coded in [accessService.ts](src/services/accessService.ts)).

---

## Root Files

```
FastReportPWA/
├── package.json              npm manifest. Scripts: dev (vite --host), build (vue-tsc --noEmit + vite build),
│                             preview (vite preview --host). Deps: vue 3.5, vue-router 4.5, primevue 4.3,
│                             @primeuix/themes, primeicons, @supabase/supabase-js 2.118, jszip 3.10.
│                             Dev deps: @vitejs/plugin-vue, vite 6.1, vite-plugin-pwa 2, vue-tsc, typescript 5.7.
├── package-lock.json         Pinned dependency tree.
├── index.html                Vite entry. Mobile meta tags (viewport-fit=cover, apple-mobile-web-app-capable,
│                             theme-color #2563EB), manifest + icons. Contains an inline splash screen
│                             (#splash) with its own fade-in/out logic: window.__splashReady() is called from
│                             src/main.ts after Vue mounts and fades the splash after at least 1s.
├── vite.config.ts            Vite config. base is '/FastReportPWA/' when GITHUB_ACTIONS is set, else '/'. Loads
│                             the vue plugin and VitePWA (autoUpdate, globPatterns for js/css/html/svg/json/fonts,
│                             navigateFallback index.html, denylist /^\/api/). '@' alias → './src'.
├── tsconfig.json             References tsconfig.app.json + tsconfig.node.json.
├── tsconfig.app.json         TypeScript config for the app source (Vue 3 + DOM).
├── tsconfig.node.json        TypeScript config for the Vite config / Node tooling.
├── env.d.ts                  Ambient types: `import.meta.env` for VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
│                             VITE_EMAILJS_* (legacy).
├── .env.example              Template env file (never commit the real .env). Lists VITE_SUPABASE_URL,
│                             VITE_SUPABASE_ANON_KEY, VITE_EMAILJS_* (legacy, optional).
├── .gitignore                Ignores node_modules, dist, .DS_Store, *.local, .env (except .env.example), .vite.
├── README.md                 User-facing readme (features, setup, deploy, project layout).
├── PLANO.md                  Planning doc — product roadmap and high-level decisions.
├── PROGRESSO.md              Change log / progress diary of implemented features.
└── AI_PROJECT_MAP.md         THIS FILE. Project map for AI agents.
```

## Deployment

```
.github/workflows/
└── deploy.yml                GitHub Actions workflow. On push to main (or workflow_dispatch): checks out, sets up
                              Node 20 (npm cache), runs `npm ci` + `npm run build` with VITE_SUPABASE_URL and
                              VITE_SUPABASE_ANON_KEY injected from repo secrets, uploads `dist` via
                              actions/upload-pages-artifact@v3, then deploys to GitHub Pages
                              (actions/deploy-pages@v4). concurrency group "pages" with cancel-in-progress.
```

## Config

```
.vscode/
└── settings.json             VS Code workspace settings.
```

## PWA assets

```
public/
├── manifest.json             PWA manifest (name, icons, start_url, display, theme/background colors).
├── favicon.svg               Browser favicon.
├── icon-192.svg              PWA icon 192×192 (also used as apple-touch-icon).
├── icon-512.svg              PWA icon 512×512.
└── na.jpg                    Placeholder photo used by src/services/defaultPhoto.ts for empty slots.
```

## Architecture documentation

```
arquitetura/
├── README.md                 Index of the 8 architecture docs.
├── 01-visao-geral.md         Overall vision and scope.
├── 02-modelos-de-dados.md    Data models — mirrors src/models/types.ts.
├── 03-mapas-de-organizacao.md  Organization maps spec (inspection-t24, tendons-retrofit).
├── 04-fluxos-de-trabalho.md  Workflows: create → capture → triage → review → export.
├── 05-regras-de-negocio.md   Business rules.
├── 06-telas-e-navegacao.md   Screen map and navigation rules — mirrors src/app/router/index.ts.
├── 07-processamento-de-imagem.md  Image processing rules (resize/compress/thumb).
├── 08-internacionalizacao.md  i18n conventions (pt/en).
└── na.jpg                    Placeholder image referenced from these docs.
```

## Database & backend

```
sql/
├── schema.sql                Base Postgres schema (fr_settings, fr_access, fr_backups, fr_temp_exports).
├── cleanup_and_new_schema.sql  Migration script that drops legacy objects and recreates the schema cleanly.
└── fix_create_fr_backups.sql   Fix-up for the fr_backups table.

supabase/
├── migrations/
│   ├── 20261101_temp_exports.sql           Table + RLS for fr_temp_exports (short-lived download links).
│   ├── 20261101_auto_cleanup.sql           Scheduled cleanup job for expired temp exports and old backups.
│   └── 20261101_send_email_function.sql    SQL side of the email-sending RPC (fr_projects_pending_notification
│                                            etc.).
└── functions/
    ├── send-export-link/index.ts            Deno Edge Function (POST). Reads { downloadUrl, email, projectName }
    │                                         from the body and calls Resend (RESEND_API_KEY, FROM_EMAIL env) to
    │                                         send the export email with the signed download link. Used from the
    │                                         app whenever a user exports a project and chooses "send by email".
    └── notify-expiring-projects/index.ts    Deno Edge Function invoked on a schedule. Runs the
                                              fr_projects_pending_notification RPC, zips each pending project's
                                              photos from Storage (bucket fr-photos, path <user_id>/<project_id>)
                                              via jszip, uploads the zip to a short-lived download URL, and emails
                                              the owner through Resend before the project expires.
```

---

## Sources — Application Code

All source lives under `src/`. Import via the `@/` alias (= `src/`).

```
src/
├── main.ts                   ENTRY POINT. Creates the Vue app, builds the PrimeVue preset (Aura with a greyscale
│                             primary ramp), installs the router, PrimeVue, ConfirmationService, ToastService,
│                             mounts to #app, calls window.__splashReady() (defined in index.html) and swallows
│                             iOS pinch gestures (gesturestart/gesturechange preventDefault). Imports global.css
│                             and primevue.css.
├── App.vue                   Root component. Nothing but <AppLayout />.
├── env.d.ts                  (See root files above.)
├── assets/
│   └── na.jpg                Placeholder image bundled with the app (src-side copy of public/na.jpg, loaded via
│                             import so it's hashed in the build output; used by defaultPhoto.ts).
├── styles/
│   ├── tokens.css            CSS custom properties: colors, spacing, radius, font-sizes, header/toolbar/touch
│   │                         sizes, safe-area insets. Dark mode variants under .dark-mode. Single source of
│   │                         truth for design tokens — views reference --color-*, --spacing-*, --radius-*…
│   ├── global.css            Global reset + body/#app rules + utility classes. Imports tokens.css.
│   └── primevue.css          Overrides for PrimeVue components to match the tokens theme.
├── i18n/
│   ├── pt.ts                 Portuguese dictionary (flat Record<string, string>).
│   └── en.ts                 English dictionary. Same keys as pt.ts.
├── data/
│   ├── inspection-t24.json   Organization map JSON for T24 inspection projects.
│   ├── tendons-retrofit.json Organization map JSON for tendons-retrofit projects.
│   └── patchNotes.ts         Versioned release notes shown in the PatchNotesModal. Add a new entry at the
│                             TOP of the array on every deploy (version, date, items.pt / items.en bullets).
├── models/
│   └── types.ts              Pure TypeScript types: LocalizedName, Slot, OrganizationMap, ProjectMetadata,
│                             Photo, Project, PhotoBlob, AppSettings, UndoEntry. No runtime code.
├── services/                 Business logic. Pure modules that compose the composables.
├── composables/              Vue 3 composables. Reactive global stores (modules keep refs/reactive at module
│                             scope so every caller shares the same state).
├── components/               Reusable UI components.
├── pages/                    Route views. One folder per page.
└── app/
    ├── layouts/
    │   └── AppLayout.vue     Shell: header (AppHeader) + toolbar (PageToolbar) + <router-view /> + global Toast,
    │                         ConfirmDialog, ImportOverlay. Boots on mount: loads projects + settings, checks
    │                         access (via accessService.checkAccess; a non-'allowed' result logs out and sends to
    │                         /auth), starts settingsSync, and on a brand-new device (no fr_device_initialized
    │                         localStorage key) lists remote backups and shows a sync banner. isFullscreen hides
    │                         the header/toolbar for triage and the download page. Toast and ConfirmDialog are
    │                         mounted here globally.
    └── router/
        └── index.ts          Vue Router (createWebHashHistory — hash-based URLs because GitHub Pages serves a
                              static site with no SPA fallback for nested paths). Declares PageAction type and
                              RouteMeta augmentation (title, isHome, fullscreen, fallbackRoute, public, actions).
                              Routes: /auth, / (home), /projects/new, /projects/:id (details),
                              /projects/:id/review, /projects/:id/triage (fullscreen), /projects/list, /maps,
                              /settings, /settings/access, /download (public). beforeEach guard: calls
                              useAuth().check() once, allows public routes, else redirects to /auth when not
                              authenticated.
```

### Services — `src/services/`

```
services/
├── supabase.ts              Creates the shared supabase client from VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.
├── authService.ts           Thin wrapper over supabase.auth. checkAuth (returns current AuthUser or null),
│                            sendOtp(email), verifyOtp(email, token), logout, updateProfile(name),
│                            onAuthStateChange(cb). AuthUser = { id, email, name }.
├── accessService.ts         Reads/writes fr_access rows. ADMIN_EMAIL constant = '92ruas@gmail.com'
│                            (isAdmin helper). checkAccess(email) returns 'allowed' | 'revoked' | 'denied',
│                            consumed by the router guard / AppLayout boot. Backs the AccessControlPage admin UI.
├── db.ts                    IndexedDB wrapper. DB_NAME 'fastreport', DB_VERSION 1, stores 'projects',
│                            'blobs', 'settings'. Exposes boot(), getAllProjects, saveProject (markSaving/
│                            markSaved via useSaveStatus — debounced), deleteProject, getAllBlobsForProject,
│                            savePhotoBlob, deletePhotoBlob, saveAllSettings, loadAllSettings. All persistence
│                            goes through this file.
├── mapCatalog.ts            Loads the two JSONs from src/data/ as OrganizationMap. Exports getAllMaps,
│                            getMap(id), getSlot(map, slotId), plus helpers getClassifiableSlots, hasGroups,
│                            getGroups used by the triage and review screens.
├── slugify.ts               slugify(name) — NFD strip accents → underscore-separate alphanumerics; used for
│                            Project.slug and folder names in exports.
├── fileNamer.ts             slotFileToken(slot), slotPath(slot), nextIndex(photos, slotId) — rules for naming
│                            photo files when exporting (<slotFileToken>_<index>.jpg) and for the folder layout
│                            inside the ZIP.
├── imageProcessor.ts        Browser image pipeline. processImage(file): orientation-correct createImageBitmap →
│                            downscale to MAX_SIZE 1024 at JPEG_QUALITY 0.85 → returns ProcessedImage
│                            (id, name, blob, url, width, height). generateThumb at THUMB_WIDTH 256 /
│                            THUMB_QUALITY 0.75. revokeImageUrl(url) to release Object URLs.
├── photoEditor.ts           In-browser JPEG transforms backed by OffscreenCanvas (with fallback). rotate90cw,
│                            rotate90ccw, mirrorH, mirrorV — each takes/returns a Blob at JPEG_QUALITY 0.85.
│                            Used by the photo viewer's edit actions.
├── defaultPhoto.ts          addDefaultPhoto(projectId) — fetches assets/na.jpg, processes it through
│                            imageProcessor, stores the blobs, returns a Photo pinned to the first slot. Used
│                            when a slot requires a placeholder (project create / recovery).
├── exportService.ts         Builds the export ZIP (JSZip). exportProject(project, layout, onProgress) — layout
│                            'folders' writes each slot into slotPath(slot)/<slotFileToken>_<n>.jpg, 'flat'
│                            writes <slotFileToken>_<n>.jpg at the root. Also writes fastreport.json
│                            (ProjectMetadata) + emits ExportProgress ticks.
├── zipImportService.ts      importZip(file, onProgress) — reads fastreport.json (or .fastreport.json), resolves
│                            the map via mapCatalog, reprocesses every image through imageProcessor +
│                            generateThumb, creates a Project via useProjects, attaches photos via usePhotoStore.
├── backupSync.ts            Remote backup to Supabase Storage. syncProject(project, userEmail, onProgress) —
│                            runs exportProject to get a ZIP, uploads it under <user_id>/<slug>.zip, writes an
│                            fr_backups row. listRemoteBackups(), restoreBackup(path), deleteRemoteBackup(path).
│                            The AppLayout new-device sync banner uses listRemoteBackups.
├── settingsSync.ts          Realtime sync of fr_settings between devices. startSettingsSync(settings) opens a
│                            RealtimeChannel, pulls lang_pref + ui from Supabase, watches the reactive settings
│                            object (debounced writes guarded by a remoteUpdate flag to avoid echo loops).
│                            stopSettingsSync tears it down (AppLayout onUnmounted).
└── undoManager.ts           useUndo composable (ref stack of UndoEntry). push/pop/clear/removeByPhoto used by
                             the viewer to undo photo moves (fromSlot → toSlot) and image edits (prevFull /
                             prevThumb blobs kept inline).
```

### Composables — `src/composables/`

```
composables/
├── useAuth.ts                Module-scope authenticated + currentUser refs. check() delegates to
│                             authService.checkAuth and sets up onAuthStateChange once. sendOtp, verifyOtp,
│                             logout, updateProfile.
├── useProjects.ts            Module-scope projects ref + ready flag. load() boots db and hydrates projects,
│                             saveProjectNow(project), createProject(name, mapId), deleteProject, getProject,
│                             projectStats, photosInSlot. Auto-fills missing slots via defaultPhoto when needed.
├── usePhotoStore.ts          URL cache for photo blobs. loadProjectUrls(projectId) materializes Object URLs
│                             for every PhotoBlob of a project; revokeAllUrls clears them when leaving.
│                             addPhotosToInbox, movePhoto, replacePhotoBlob — mutate the Project in place and
│                             call useProjects().saveProjectNow (indirectly through db.ts).
├── usePhotoImport.ts         Device file-picker with CONCURRENCY 3. selectFiles() opens <input type=file
│                             multiple accept=image/*>, then processes each through imageProcessor +
│                             generateThumb in parallel (3 at a time) while updating reactive importing,
│                             progress, totalFiles, processedFiles, currentFileName — surfaced by ImportOverlay.
│                             Hands the blobs to usePhotoStore().addPhotosToInbox.
├── useProjectCreate.ts       Form model for NewProjectPage. name, mapId refs, derived slug (slugify),
│                             nameError (duplicate check against existing projects), create().
├── useProjectSession.ts      Currently-open project state. currentProjectId ref, derived project + map +
│                             stats computeds. Owns the per-project Object-URL lifetime (loadProjectUrls on
│                             enter, revokeAllUrls on exit).
├── useProjectSyncMap.ts      Pure helpers: isProjectSynced, isProjectSyncStale, projectSyncState('synced' |
│                             'stale' | 'never') from Project.syncedAt vs updatedAt. No Vue reactivity.
├── useSettings.ts            reactive AppSettings with defaults (langPref 'auto', ui 1, userName/userEmail
│                             ''). load() hydrates from db.loadAllSettings, deep watch persists via
│                             db.saveAllSettings after the first load.
├── useSaveStatus.ts          Save-state indicator. markSaving / markSaved / markError update pendingOps,
│                             lastSavedAt, lastErrorMsg timers. Fed by db.ts; shown by small status dots in
│                             the UI.
├── useI18n.ts                t(key) computed-bound to useSettings().langPref, falling back to navigator.lang
│                             when langPref is 'auto'. Loads pt / en dictionaries from src/i18n/.
├── useNavigation.ts          goBack() — router.back() when history has a back entry, else router.replace to
│                             route.meta.fallbackRoute (defaulting to '/'). Used by the header back button.
├── usePageTitle.ts           Per-page title override (ref<string | null>). Views call setTitle; AppLayout
│                             prefers titleOverride over route.meta.title. Auto-clears on unmount.
└── usePageActions.ts         Per-page toolbar actions override (ref<PageAction[] | null>). Views call
                              setActions([{ icon, label, handler }]); PageToolbar renders either the override
                              or route.meta.actions. Auto-clears on unmount.
```

### Components — `src/components/`

```
components/
├── navigation/
│   ├── AppHeader.vue         Sticky top header (title + right-side action icons from headerActions). On Home,
│   │                         the header shows a "+" action that navigates to /projects/new.
│   └── PageToolbar.vue       Secondary toolbar under the header. Renders a back button (useNavigation.goBack)
│                             + the list of PageActions for the current route (route.meta.actions or the
│                             usePageActions override).
├── common/
│   ├── ProjectTabs.vue       Tab strip switching between the Project Details / Project Review views.
│   └── SwipeActions.vue      Touch gesture wrapper that reveals left/right action buttons on swipe. Used by
│                             list rows (project lists, access control entries, …).
└── feedback/
    ├── ImportOverlay.vue     Fullscreen modal shown while usePhotoImport is running. Progress bar tied to
    │                         processedFiles / totalFiles + the current file name. Blocks input until done.
    └── PatchNotesModal.vue   Bottom-sheet shown once per new deploy. Reads latestPatchNote() from
                              src/data/patchNotes.ts and compares its version with localStorage
                              key 'fr_last_patch_version'. On close it stores the version so it stays hidden
                              until the next release. Mounted globally in AppLayout.
```

### Pages — `src/pages/`

```
pages/
├── Auth/
│   └── AuthPage.vue              Fullscreen login (public). Supabase email OTP flow via authService:
│                                  sendOtp → verifyOtp. Once authenticated, the router guard forwards to /.
├── Home/
│   └── HomePage.vue              Home screen. Lists recent projects + quick actions (new project, open
│                                  maps/settings). isHome in the router meta hides the toolbar back button
│                                  and adds the "+" header action in AppLayout.
├── NewProject/
│   └── NewProjectPage.vue        Create-project form, powered by useProjectCreate. Picks a map, types a
│                                  name (validated against existing slugs), then creates via useProjects
│                                  and navigates to the project details.
├── ProjectList/
│   └── ProjectListPage.vue       Full list of all projects with filter/sort + swipe-to-delete (SwipeActions).
│                                  Shows sync state (projectSyncState) when backupSync is set up.
├── ProjectDetails/
│   └── ProjectDetailsPage.vue    One project's detail view. Shows the slot grid (every map slot with its
│                                  photo count), inbox badge, import buttons (usePhotoImport.selectFiles),
│                                  entry points to /review and /triage, and export/sync actions.
├── ProjectReview/
│   └── ProjectReviewPage.vue     Per-slot review grid. Thumbnails per slot, drag to reorder, tap to open the
│                                  PhotoViewer, batch move/delete, replace with default photo. Uses
│                                  useProjectSession for the open project.
├── PhotoViewer/
│   └── PhotoViewerPage.vue       Fullscreen triage/view. Swipe between photos + hotkey classification per
│                                  slot (hotkeys live in the map). Edit actions (rotate/mirror via
│                                  photoEditor), undo (undoManager). The /projects/:id/triage route is this
│                                  page.
├── Maps/
│   └── MapsPage.vue              Read-only browser for the organization maps (inspection-t24,
│                                  tendons-retrofit). Lists slots, groups, hotkeys, expected counts.
├── Settings/
│   └── SettingsPage.vue          Settings: language preference, UI density (ui), user name/email
│                                  (useSettings), authentication actions (logout), link to access control,
│                                  export layout preference, destructive actions (clear data).
├── AccessControl/
│   └── AccessControlPage.vue     Admin-only (isAdmin). CRUD of fr_access rows — invite, revoke, restore
│                                  emails. Non-admins never reach it (router redirects or empty state).
└── Download/
    └── DownloadPage.vue          Public fullscreen download confirmation. Opened from the fr_temp_exports
                                  link — looks up the signed URL and offers the ZIP for download without
                                  requiring auth. Route meta.public = true so the router guard lets it through.
```

---

## Key Architecture Decisions

| Decision | Reason |
|---|---|
| Vue 3 Composition API + composables | Shared reactive state lives in module-scope refs inside composables — simpler than Pinia for this scale and avoids an extra dependency |
| `createWebHashHistory` | GitHub Pages serves a static site with no SPA fallback for nested paths; hash routes work without a server rewrite rule |
| IndexedDB as the source of truth | Offline-first: full photo blobs + thumbs live on-device. Supabase is only for auth, settings sync, remote backups and short-lived exports |
| PrimeVue 4 + custom Aura preset | Aura themed with a greyscale primary ramp in main.ts; design tokens in styles/tokens.css drive everything else |
| `vite-plugin-pwa` autoUpdate | New SW takes over automatically; no update prompt needed. Workbox precaches js/css/html/svg/json/fonts |
| Supabase Edge Functions (Deno) for email | Sending email needs a secret (Resend API key) that can't live in the client. `send-export-link` is called on-demand; `notify-expiring-projects` runs on a schedule |
| Hard-coded admin email | `ADMIN_EMAIL = '92ruas@gmail.com'` in accessService.ts — single-owner app; bootstraps the first admin without a seed migration |
| i18n via plain Record maps | Flat key→string dictionaries in src/i18n/{pt,en}.ts; no runtime dep. Language auto-detected from navigator.language unless overridden in Settings |
| Organization maps as static JSON | Maps are versioned product data, not user data — bundled under src/data/ and loaded by mapCatalog.ts. Creating/editing maps is not an in-app feature |

---

## Build & Run

```bash
# Install
npm install

# Dev server (binds 0.0.0.0 so mobile devices on the LAN can open it)
npm run dev

# Type-check + build to dist/
npm run build

# Preview the built app
npm run preview
```

Environment (`.env`, copied from `.env.example`):

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

Deployment to GitHub Pages is automatic on every push to `main` (see `.github/workflows/deploy.yml`). The same two secrets must be configured in the repo's **Settings → Secrets → Actions**.

## Conventions

- **One responsibility per file** — one component / composable / service per file.
- **Composables** own reactive state at module scope so every caller shares the same store.
- **Services** are pure TypeScript modules — no Vue reactivity, callable from anywhere.
- **Pages** are thin: wire composables + services, hand data to components; no direct IndexedDB or Supabase calls.
- **Styling** — use the design tokens in [tokens.css](src/styles/tokens.css); never hard-code colors or spacing in a scoped `<style>`.
- **i18n** — every user-facing string goes through `useI18n().t(key)`; add the key to both pt.ts and en.ts in the same change.
- **Persistence** — any write that must survive reload goes through [db.ts](src/services/db.ts), which drives [useSaveStatus](src/composables/useSaveStatus.ts).
