<?php

namespace App\Console\Commands;

use App\Enums\Permission as PermissionEnum;
use App\Models\Permission;
use App\Models\Role;
use App\Support\DefaultRoles;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SyncPermissions extends Command
{
    protected $signature = 'rbac:sync {--prune : Delete permissions that no longer exist in App\Enums\Permission}';

    protected $description = 'Create/update permissions from App\Enums\Permission and make sure the default roles exist';

    public function handle(): int
    {
        DB::transaction(function () {
            foreach (PermissionEnum::cases() as $case) {
                Permission::updateOrCreate(['name' => $case->value], [
                    'display_name' => $case->label(),
                    'description' => $case->description(),
                    'group' => $case->group(),
                ]);
            }

            if ($this->option('prune')) {
                $stale = Permission::whereNotIn('name', PermissionEnum::values())->pluck('name');
                Permission::whereIn('name', $stale)->delete();
                $stale->each(fn ($name) => $this->warn("Removed stale permission: {$name}"));
            }

            $ids = Permission::pluck('id', 'name');
            foreach (DefaultRoles::all() as $name => $definition) {
                $role = Role::firstOrCreate(['name' => $name], [
                    'display_name' => $definition['display_name'],
                    'description' => $definition['description'],
                    'is_system' => $definition['is_system'],
                ]);
                // Only seed permissions for new roles (admins may have customised existing ones);
                // system roles are always kept complete.
                if ($role->wasRecentlyCreated || $role->is_system) {
                    $role->permissions()->sync(collect($definition['permissions'])->map(fn (PermissionEnum $p) => $ids[$p->value]));
                }
            }
        });

        $this->info(sprintf('Permissions synced: %d permissions, %d roles.', Permission::count(), Role::count()));

        return self::SUCCESS;
    }
}
