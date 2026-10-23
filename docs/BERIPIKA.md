# Beripika — developer notes

Rebuild of the old **verifier** ("Check with CHED") app on Laravel 13 · Inertia v3 · React 19 · Tailwind 4 · PHP 8.5.
Business logic (portal sync, SOAIS imports, permits, concerns) is carried over unchanged; the database,
RBAC and shell were reworked.

## First-time setup

```bash
composer install
composer require phpoffice/phpspreadsheet   # Excel reader used by the SOAIS / institutions imports
npm install
copy .env.example .env                       # then set DB_*, PORTAL_API, ADMIN_EMAIL / ADMIN_PASSWORD
php artisan key:generate
php artisan migrate --seed                   # creates permissions, default roles, first super admin
composer run dev                             # server + queue (default,imports) + vite
```

Copy the old data (optional, run once on an empty database right after `migrate --seed`):

```bash
# .env: LEGACY_DB_DATABASE=verifier (same MySQL server by default)
php artisan beripika:import-legacy
```

It copies users, institutions, programs, program catalog, graduates, concerns and activity logs,
keeps record IDs, converts dates, maps `admin → super_admin`, `prc → verifier`, recreates custom roles,
and keeps the old password of the account that shares `ADMIN_EMAIL`.

Production cron (shared hosting): `* * * * * php artisan schedule:run` — drains the queue every minute and
prunes old import files nightly.

## Database changes vs. verifier

| Area | Change |
|---|---|
| Migrations | 17 incremental migrations folded into 5 clean ones (`2026_10_23_*`) |
| graduates | `date_graduated`, `date_of_birth` are real `DATE` columns; `course_from_excel → program_name`, `major_from_excel → major`; lookup keys (`identity_key`, `program_key`, `major_key`, `graduation_year`) built in |
| RBAC | `users.role` string removed; `users.role_id` FK (restrict on delete); pivot renamed `permission_role`; `roles.is_system`; `users.last_login_at` |
| concerns | `status` (pending / in_progress / resolved / dismissed), `institution_code`, `resolved_by`, `resolved_at` |
| activity_logs | `ip_address`, `user_agent`, morph index |
| programs | institutions re-import updates instead of duplicating programs |

## RBAC

* **Source of truth:** `app/Enums/Permission.php` (name, group, label, description). Mirror: `resources/js/types/permissions.ts`.
* After adding a permission: `php artisan rbac:sync` (add `--prune` to delete removed ones).
* Default roles (`app/Support/DefaultRoles.php`): **Super Administrator** (locked, always everything),
  Administrator, CHED Staff, External Verifier (e.g. PRC, read-only), Viewer. All but super admin are editable.
* Backend: every route has `->middleware('can:<permission>')`; record rules live in `app/Policies`.
* Frontend: `usePermissions()` → `can('update_graduates')`, or `<Can permission="manage_roles">…</Can>`.
  The sidebar hides modules the user cannot open. UI checks are cosmetic — the server always enforces.
* Guards: deactivated users cannot sign in and are signed out mid-session; nobody can delete, deactivate or
  re-role themselves; only a super admin can assign or edit super admins; roles with users cannot be deleted.
* Users without `view_dashboard` are forwarded to the first module they can open.
* Sign-ins/outs, user, role, concern, graduate and import changes are written to Activity Logs.

## Security fixes carried in

* Permit PDF proxy only fetches from the configured portal host (was an open proxy).
* Public `/api/program/{id}` returns a graduate **count**, not names/birthdates.
* User list `sort_by` is whitelisted; new users get a random temporary password instead of `12345678`.
* Public registration is off — accounts are created by administrators.

## Tests

`php artisan test` — 80 tests (RBAC, imports, concerns, graduates, auth).
