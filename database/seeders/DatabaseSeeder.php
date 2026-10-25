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
     * Configure the first account with ADMIN_EMAIL / ADMIN_PASSWORD in .env. When no password is
     * given, a random one is generated and printed once.
     */
    public function run(): void
    {
        $this->call(RolesAndPermissionsSeeder::class);
        $this->createSuperAdmin();
        $this->call(DemoUsersSeeder::class);
    }

    private function createSuperAdmin(): void
    {
        $email = env('ADMIN_EMAIL', 'chedro12hemis@ched.gov.ph');
        if (User::where('email', $email)->exists()) {
            return;
        }

        $password = env('ADMIN_PASSWORD') ?: Str::password(16, symbols: false);
        User::forceCreate([
            'name' => env('ADMIN_NAME', 'CHED Administrator'),
            'email' => $email,
            'password' => $password,
            'email_verified_at' => now(),
            'role_id' => Role::where('name', DefaultRoles::SUPER_ADMIN)->value('id'),
            'is_active' => true,
        ]);

        if (! env('ADMIN_PASSWORD')) {
            $this->command?->warn("Super administrator created: {$email} / {$password}  (change it after signing in)");
        }
    }
}
