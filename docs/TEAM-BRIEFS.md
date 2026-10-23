# UI revamp — briefs for parallel sessions

Backend, database and RBAC are done (see `docs/BERIPIKA.md`). Remaining work is **UI only**.
Each session works on its own branch and only touches the files it owns. Do not change controllers,
routes, migrations or `app/Enums/Permission.php` — ask the owner of `main` instead.

Common rules: Tailwind 4 + shadcn/ui (`resources/js/components/ui`), `usePermissions()` / `<Can>` for
showing actions, pages declare breadcrumbs with `Page.layout = { breadcrumbs: [...] }`, run
`npm run types:check` and `php artisan test` before merging.

## Session 1 — Shell & branding (`feat/ui-shell`)
Owns: `resources/css/app.css`, `layouts/**`, `components/app-*`, `nav-*`, `user-*`, `app-logo*`,
`pages/welcome.tsx`, `components/welcome/**`, `pages/auth/**`, `pages/settings/**`.
Goal: Beripika brand (colors, logo, typography, dark mode), polished sidebar/header, public
verification page (search + map + permit dialog), login.

## Session 2 — Records pages (`feat/ui-records`)
Owns: `pages/dashboard.tsx`, `pages/institution/**`, `pages/programs/**`, `pages/graduates/**`,
`components/dashboard/**`, `components/graduates/**`, `components/admin-institution/**`.
Goal: modern dashboard cards/charts, faster tables (filters, empty states, mobile), a clean
graduate verification view for external verifiers.

## Session 3 — Admin pages (`feat/ui-admin`)
Owns: `pages/users/**`, `pages/roles/**`, `pages/import/**`, `pages/concerns/**`, `pages/logs/**`,
`components/graduate-import*`.
Goal: consistent admin tables, user/role dialogs, import progress UX, concern status workflow,
log filters (`/logs?q=&action=` already supported by the backend).

Merge order: shell → records → admin, running the tests after each merge.
