<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

class DemoUsersSeeder extends Seeder
{
    /** Shared password for every demo account. Local development only. */
    public const PASSWORD = 'password';

    /** @var array<string, array{0: string, 1: string}> role name => [display name, email] */
    public const ACCOUNTS = [
        'admin' => ['CHED Admin (demo)', 'admin@beripika.test'],
        'staff' => ['CHED Records Staff (demo)', 'staff@beripika.test'],
        'verifier' => ['PRC Personnel (demo)', 'prc@beripika.test'],
        'viewer' => ['Viewer (demo)', 'viewer@beripika.test'],
    ];

    /**
     * One account per default role so each role's view of the admin can be checked.
     * Runs only when APP_ENV=local; re-running resets the accounts to their defaults.
     */
    public function run(): void
    {
        if (! app()->isLocal()) {
            $this->command?->warn('Demo users skipped: APP_ENV is not local.');

            return;
        }

        $roleIds = Role::whereIn('name', array_keys(self::ACCOUNTS))->pluck('id', 'name');

        foreach (self::ACCOUNTS as $role => [$name, $email]) {
            User::firstOrNew(['email' => $email])->forceFill([
                'name' => $name,
                'password' => self::PASSWORD,
                'email_verified_at' => now(),
                'role_id' => $roleIds[$role] ?? null,
                'is_active' => true,
            ])->save();
        }

        $this->command?->info(sprintf('Demo users ready (password "%s"): %s',
            self::PASSWORD, implode(', ', array_column(self::ACCOUNTS, 1))));
    }
}
