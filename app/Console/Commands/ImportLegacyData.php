<?php

namespace App\Console\Commands;

use App\Models\Permission;
use App\Models\Role;
use App\Services\GraduateData;
use App\Support\DefaultRoles;
use Illuminate\Console\Command;
use Illuminate\Database\Connection;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Copies data from the old "verifier" database into the new schema.
 *
 *   LEGACY_DB_DATABASE=verifier php artisan beripika:import-legacy
 *
 * Column changes handled here:
 *   graduates.course_from_excel -> program_name, major_from_excel -> major,
 *   date_graduated / date_of_birth text -> DATE, users.role (string) -> role_id.
 * Record IDs are preserved so relationships stay intact.
 */
class ImportLegacyData extends Command
{
    protected $signature = 'beripika:import-legacy
        {--connection=legacy : Database connection of the old app}
        {--only=* : Limit to tables: users, institutions, programs, program_catalogs, graduates, concerns, activity_logs}
        {--force : Run even when the target tables already contain data}';

    protected $description = 'Import institutions, programs, graduates, users, concerns and logs from the old verifier database';

    private const ORDER = ['users', 'institutions', 'programs', 'program_catalogs', 'graduates', 'concerns', 'activity_logs'];

    private Connection $legacy;

    /** @var array<string, int> */
    private array $roleMap = [];

    public function handle(): int
    {
        $this->legacy = DB::connection($this->option('connection'));
        $tables = $this->option('only') ?: self::ORDER;

        if (! $this->option('force')) {
            $busy = collect($tables)->filter(fn ($t) => DB::table($t)->when($t === 'users', fn ($q) => $q->whereNotIn('email', [config('app.admin.email')]))->exists());
            if ($busy->isNotEmpty()) {
                $this->error('Target tables already have data: '.$busy->implode(', ').'. Use --force to merge (existing IDs are skipped).');

                return self::FAILURE;
            }
        }

        Artisan::call('rbac:sync');

        foreach (self::ORDER as $table) {
            if (! in_array($table, $tables, true)) {
                continue;
            }
            if (! $this->legacy->getSchemaBuilder()->hasTable($table)) {
                $this->warn("Skipping {$table}: not found in the legacy database.");

                continue;
            }
            $count = $this->{'import'.str($table)->studly()}();
            $this->info(sprintf('%-18s %s rows', $table, number_format($count)));
        }

        $this->newLine();
        $this->info('Done. Review users and their roles under Users before going live.');

        return self::SUCCESS;
    }

    private function copy(string $table, callable $map, array $columns = ['*']): int
    {
        $total = 0;
        $this->legacy->table($table)->select($columns)->orderBy('id')->chunk(1000, function ($rows) use ($table, $map, &$total) {
            $payload = $rows->map(fn ($row) => $map((array) $row))->filter()->values()->all();
            if ($payload) {
                DB::table($table)->insertOrIgnore($payload);
                $total += count($payload);
            }
        });

        return $total;
    }

    private function importUsers(): int
    {
        $ids = Role::pluck('id', 'name');
        $legacyRoles = $this->legacy->getSchemaBuilder()->hasTable('roles')
            ? $this->legacy->table('roles')->get()->keyBy('id') : collect();

        // Recreate custom roles from the old app with the same permission names.
        foreach ($legacyRoles as $legacyRole) {
            if (in_array($legacyRole->name, ['admin', 'prc'], true) || $ids->has($legacyRole->name)) {
                continue;
            }
            $role = Role::create(['name' => $legacyRole->name, 'display_name' => $legacyRole->display_name, 'description' => $legacyRole->description]);
            $names = $this->legacy->table('role_permission')->join('permissions', 'permissions.id', '=', 'role_permission.permission_id')
                ->where('role_permission.role_id', $legacyRole->id)->pluck('permissions.name');
            $role->permissions()->sync(Permission::whereIn('name', $names)->pluck('id'));
            $ids[$role->name] = $role->id;
        }

        $resolve = function (array $row) use ($ids, $legacyRoles): ?int {
            $name = $row['role_id'] ?? null ? ($legacyRoles[$row['role_id']]->name ?? null) : null;
            $name ??= $row['role'] ?? null;

            return match ($name) {
                'admin' => $ids[DefaultRoles::SUPER_ADMIN],
                'prc' => $ids['verifier'],
                null => null,
                default => $ids[$name] ?? null,
            };
        };

        $has = fn (string $column) => $this->legacy->getSchemaBuilder()->hasColumn('users', $column);

        // Existing accounts (e.g. the seeded super admin) win over legacy rows with the same ID or email.
        $taken = DB::table('users')->get(['id', 'email']);
        foreach ($this->legacy->table('users')->get(['id', 'email']) as $legacyUser) {
            $clash = $taken->first(fn ($u) => $u->id === $legacyUser->id || strcasecmp($u->email, $legacyUser->email) === 0);
            if ($clash && strcasecmp($clash->email, $legacyUser->email) !== 0) {
                $this->warn("  user #{$legacyUser->id} ({$legacyUser->email}) skipped: ID already used by {$clash->email}. Re-create it under Users.");
            }
        }

        // The seeded super admin shares its email with the old admin: keep the old password and 2FA.
        foreach ($this->legacy->table('users')->get() as $legacyUser) {
            $existing = DB::table('users')->whereRaw('LOWER(email) = ?', [mb_strtolower($legacyUser->email)])->first();
            if ($existing) {
                DB::table('users')->where('id', $existing->id)->update([
                    'password' => $legacyUser->password,
                    'two_factor_secret' => $legacyUser->two_factor_secret ?? null,
                    'two_factor_recovery_codes' => $legacyUser->two_factor_recovery_codes ?? null,
                    'two_factor_confirmed_at' => $legacyUser->two_factor_confirmed_at ?? null,
                ]);
            }
        }

        return $this->copy('users', fn (array $row) => [
            'id' => $row['id'],
            'name' => $row['name'],
            'email' => $row['email'],
            'email_verified_at' => $row['email_verified_at'] ?? now(),
            'password' => $row['password'],                       // already hashed
            'role_id' => $resolve($row),
            'is_active' => $has('is_active') ? (bool) $row['is_active'] : true,
            'two_factor_secret' => $row['two_factor_secret'] ?? null,
            'two_factor_recovery_codes' => $row['two_factor_recovery_codes'] ?? null,
            'two_factor_confirmed_at' => $row['two_factor_confirmed_at'] ?? null,
            'remember_token' => null,
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ]);
    }

    private function importInstitutions(): int
    {
        return $this->copy('institutions', fn (array $r) => [
            'id' => $r['id'], 'institution_code' => trim($r['institution_code']), 'name' => $r['name'],
            'type' => $r['type'] ?? null, 'created_at' => $r['created_at'], 'updated_at' => $r['updated_at'],
        ]);
    }

    private function importPrograms(): int
    {
        return $this->copy('programs', fn (array $r) => [
            'id' => $r['id'], 'institution_id' => $r['institution_id'], 'program_name' => trim($r['program_name']),
            'major' => trim((string) $r['major']) ?: null, 'program_type' => $r['program_type'] ?? null,
            'permit_number' => trim((string) $r['permit_number']) ?: null,
            'created_at' => $r['created_at'], 'updated_at' => $r['updated_at'],
        ]);
    }

    private function importProgramCatalogs(): int
    {
        return $this->copy('program_catalogs', fn (array $r) => [
            'id' => $r['id'], 'program_name' => $r['program_name'], 'normalized_name' => $r['normalized_name'],
            'program_type' => $r['program_type'] ?: 'Unknown', 'notes' => $r['notes'] ?? null,
            'created_at' => $r['created_at'], 'updated_at' => $r['updated_at'],
        ]);
    }

    private function importGraduates(): int
    {
        $skipped = 0;
        $count = $this->copy('graduates', function (array $r) use (&$skipped) {
            try {
                $graduated = GraduateData::date($r['date_graduated']);
            } catch (\RuntimeException) {
                $skipped++;
                $this->warn("  graduate #{$r['id']} skipped: invalid date_graduated '{$r['date_graduated']}'");

                return null;
            }
            try {
                $birth = filled($r['date_of_birth'] ?? null) ? GraduateData::date($r['date_of_birth']) : null;
            } catch (\RuntimeException) {
                $birth = null;
            }
            $data = [
                'id' => $r['id'],
                'institution_id' => $r['institution_id'],
                'program_id' => $r['program_id'],
                'hei_uii' => $r['hei_uii'],
                'so_number' => $r['so_number'],
                'student_id_number' => $r['student_id_number'],
                'last_name' => $r['last_name'],
                'first_name' => $r['first_name'],
                'middle_name' => $r['middle_name'],
                'extension_name' => $r['extension_name'],
                'sex' => in_array($r['sex'], ['MALE', 'FEMALE'], true) ? $r['sex'] : null,
                'date_of_birth' => $birth,
                'program_name' => $r['course_from_excel'] ?? $r['program_name'],
                'major' => $r['major_from_excel'] ?? $r['major'] ?? null,
                'psced_code' => $r['psced_code'],
                'date_graduated' => $graduated,
                'academic_year' => $r['academic_year'],
                'created_at' => $r['created_at'],
                'updated_at' => $r['updated_at'],
            ];

            return $data + GraduateData::indexes($data);
        });
        if ($skipped) {
            $this->warn("  {$skipped} graduate(s) skipped because of invalid dates.");
        }

        return $count;
    }

    private function importConcerns(): int
    {
        return $this->copy('concerns', fn (array $r) => [
            'id' => $r['id'], 'school' => $r['school'], 'program' => $r['program'], 'concern' => $r['concern'],
            'status' => $r['status'] ?? 'pending', 'created_at' => $r['created_at'], 'updated_at' => $r['updated_at'],
        ]);
    }

    private function importActivityLogs(): int
    {
        $users = DB::table('users')->pluck('id')->flip();

        return $this->copy('activity_logs', fn (array $r) => [
            'id' => $r['id'], 'user_id' => isset($users[$r['user_id']]) ? $r['user_id'] : null, 'action' => $r['action'],
            'subject_type' => $r['subject_type'], 'subject_id' => $r['subject_id'], 'summary' => mb_substr((string) $r['summary'], 0, 1000),
            'properties' => $r['properties'], 'created_at' => $r['created_at'], 'updated_at' => $r['updated_at'],
        ]);
    }
}
