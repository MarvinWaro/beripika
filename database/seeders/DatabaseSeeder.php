<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use App\Support\DefaultRoles;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    /**
     * Seeds permissions, default roles, the first super administrator and (locally) demo users.
     *
     * Configure the first account with ADMIN_EMAIL / ADMIN_PASSWORD (config/app.php → admin). When no
     * password is given, a random one is generated and printed once.
     */
    public function run(): void
    {
        $this->call(RolesAndPermissionsSeeder::class);
        $this->createSuperAdmin();
        $this->call(DemoUsersSeeder::class);
    }

    private function createSuperAdmin(): void
    {
        $email = (string) config('app.admin.email');
        if (User::where('email', $email)->exists()) {
            return;
        }

        $configuredPassword = config('app.admin.password');
        $password = $configuredPassword ?: Str::password(16, symbols: false);
        User::forceCreate([
            'name' => config('app.admin.name'),
            'email' => $email,
            'password' => $password,
            'email_verified_at' => now(),
            'role_id' => Role::where('name', DefaultRoles::SUPER_ADMIN)->value('id'),
            'is_active' => true,
        ]);

        if (! $configuredPassword) {
            $this->command?->warn("Super administrator created: {$email} / {$password}  (change it after signing in)");
        }
    }
}
