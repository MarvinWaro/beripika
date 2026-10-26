<?php

namespace App\Console\Commands;

use App\Models\ActivityLog;
use App\Models\Role;
use App\Models\User;
use App\Support\DefaultRoles;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

use function Laravel\Prompts\password;
use function Laravel\Prompts\text;

/**
 * Create a super administrator from the terminal (e.g. Coolify → Terminal).
 * Asks for everything interactively so the password never lands in env vars or shell history.
 */
class MakeAdmin extends Command
{
    protected $signature = 'make:admin';

    protected $description = 'Create a super administrator account (asks for name, email and password)';

    public function handle(): int
    {
        // Fresh database: create the permissions and default roles first.
        if (! Role::where('name', DefaultRoles::SUPER_ADMIN)->exists()) {
            $this->call('rbac:sync');
        }

        $name = text(
            label: 'Name',
            required: true,
            validate: fn (string $value) => $this->firstError('name', $value, ['string', 'max:255']),
        );
        $email = text(
            label: 'Email',
            required: true,
            validate: fn (string $value) => $this->firstError('email', $value, ['email', 'max:255', 'unique:users,email']),
        );
        // Same policy as the Users page (stricter in production; see AppServiceProvider).
        $password = password(
            label: 'Password',
            required: true,
            validate: fn (string $value) => $this->firstError('password', $value, [Password::defaults()]),
        );
        password(
            label: 'Confirm password',
            required: true,
            validate: fn (string $value) => $value === $password ? null : 'The passwords do not match.',
        );

        $user = User::forceCreate([
            'name' => $name,
            'email' => $email,
            'password' => $password,
            'email_verified_at' => now(),
            'role_id' => Role::where('name', DefaultRoles::SUPER_ADMIN)->value('id'),
            'is_active' => true,
        ]);

        ActivityLog::record('user_create', "Created super administrator {$user->email} from the console", $user, [
            'role' => DefaultRoles::SUPER_ADMIN,
        ]);

        $this->components->info("Super administrator created: {$user->email}");

        return self::SUCCESS;
    }

    /** @param  array<int, mixed>  $rules */
    private function firstError(string $attribute, string $value, array $rules): ?string
    {
        return Validator::make([$attribute => $value], [$attribute => $rules])
            ->errors()->first($attribute) ?: null;
    }
}
