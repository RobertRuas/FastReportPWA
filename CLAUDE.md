# CLAUDE.md — Agent Rules for FastReport PWA

## Navigation Rule (mandatory, every task)

Before writing code, making changes, or taking any decision:

1. **Read [AI_PROJECT_MAP.md](AI_PROJECT_MAP.md) first** — it is the single source of truth for what exists, where it lives, and what each file does.
2. **Go directly to the relevant file(s)** — use the map to identify the exact file you need. Do not scan, list, or read files that are unrelated to the task.
   - UI / visual change on a page → read that page's `.vue` under [src/pages/](src/pages/).
   - Reusable UI piece → [src/components/](src/components/) (navigation, common, feedback).
   - Reactive state or shared logic → the relevant composable in [src/composables/](src/composables/).
   - Business logic (persistence, auth, export, image, maps) → the matching service in [src/services/](src/services/).
   - Data model change → [src/models/types.ts](src/models/types.ts); update both `pt.ts` and `en.ts` if user-facing strings change.
   - Routing / page skeleton → [src/app/router/index.ts](src/app/router/index.ts) and [src/app/layouts/AppLayout.vue](src/app/layouts/AppLayout.vue).
   - Organization maps → JSON files under [src/data/](src/data/) + [mapCatalog.ts](src/services/mapCatalog.ts).
   - Supabase / backend → [supabase/](supabase/), [sql/](sql/).
3. **Never read all files.** Only read what you will change or what you need to understand a dependency.

## Project conventions (recap)

- All persistence goes through [db.ts](src/services/db.ts). Don't call IndexedDB directly from pages or composables.
- Every user-facing string goes through `useI18n().t(key)`. Add the key in both [pt.ts](src/i18n/pt.ts) and [en.ts](src/i18n/en.ts) in the same change.
- Styling uses the CSS custom properties from [tokens.css](src/styles/tokens.css). Don't hard-code colors or spacing in a scoped `<style>`.
- Composables keep state in module scope — don't create per-component copies of shared state.
- Pages stay thin: compose composables + services and hand data to components.
- Admin email (`'92ruas@gmail.com'`) is the single source of truth in [accessService.ts](src/services/accessService.ts); don't duplicate it.

## After structural changes

When you create, move, rename, or delete any file or directory (routes, pages, services, composables, components, SQL files, Edge Functions, etc.), update [AI_PROJECT_MAP.md](AI_PROJECT_MAP.md) to reflect the change before finishing the task.

Also update the map when a service or composable's public API changes meaningfully — the one-line descriptions in the map must stay accurate.

## Testing a change

- UI change → `npm run dev` and open the page on a real mobile viewport (the PWA is mobile-first). Chrome DevTools device mode is fine for layout but doesn't cover touch gestures (SwipeActions, triage) — test those on a phone when you can.
- Type-check/build before declaring a task done: `npm run build` (runs `vue-tsc --noEmit` then Vite build).
- Supabase-related changes: verify the matching migration/SQL is applied; the Edge Functions and the client code must agree on the function/table name.

## Deploying

Deploy is automatic on push to `main` via [.github/workflows/deploy.yml](.github/workflows/deploy.yml) — GitHub Actions runs `npm ci && npm run build` with the two repo secrets (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) and publishes `dist/` to GitHub Pages at https://robertruas.github.io/FastReportPWA/.

When the user asks to "deploy", "ship", "publish", or "release":

0. **Add a patch note entry** at the top of [src/data/patchNotes.ts](src/data/patchNotes.ts) describing the changes being shipped — version (`YYYY.MM.DD`), date (ISO), and a short bulleted list in both `pt` and `en`. The PatchNotesModal shows the latest entry on the first load after deploy.

1. **Commit all pending changes** on `main`:
   ```bash
   git add <files>
   git commit -m "message"
   git push origin main
   ```

2. **Confirm the workflow**:
   ```bash
   gh run watch           # or gh run list / gh run view
   ```

3. **Report success** with the live URL:
   ```
   Deployed → https://robertruas.github.io/FastReportPWA/
   ```

There is no tag-based release flow — every merge to `main` is a release.

## Supabase Edge Functions

If a change touches [supabase/functions/](supabase/functions/), it is not deployed by the GitHub Actions workflow — deploy it explicitly with the Supabase CLI:

```bash
supabase functions deploy send-export-link
supabase functions deploy notify-expiring-projects
```

Check that the required secrets (`RESEND_API_KEY`, `FROM_EMAIL`, `SUPABASE_SERVICE_ROLE_KEY`) are set in the Supabase project before invoking them.

## Database migrations

SQL under [supabase/migrations/](supabase/migrations/) must be applied in order. If you add a migration, give it a date-prefixed filename matching the existing pattern (`YYYYMMDD_<slug>.sql`) and mention in the PR / commit message whether it has been applied to the live project yet.
