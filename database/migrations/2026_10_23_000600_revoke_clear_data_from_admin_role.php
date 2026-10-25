<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * The default Administrator role no longer gets `clear_data` (see App\Support\DefaultRoles).
     * rbac:sync only seeds permissions for new roles, so existing databases are updated here.
     * On a fresh database the roles do not exist yet and this is a no-op.
     */
    public function up(): void
    {
        DB::table('permission_role')
            ->whereIn('role_id', DB::table('roles')->where('name', 'admin')->select('id'))
            ->whereIn('permission_id', DB::table('permissions')->where('name', 'clear_data')->select('id'))
            ->delete();
    }

    public function down(): void
    {
        $roleId = DB::table('roles')->where('name', 'admin')->value('id');
        $permissionId = DB::table('permissions')->where('name', 'clear_data')->value('id');
        if ($roleId && $permissionId) {
            DB::table('permission_role')->insertOrIgnore(['role_id' => $roleId, 'permission_id' => $permissionId]);
        }
    }
};
