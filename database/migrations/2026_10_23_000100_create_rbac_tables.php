<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Role-based access control.
     *
     * roles 1—* users, roles *—* permissions (permission_role pivot).
     * Permission names are owned by App\Enums\Permission and synced with `php artisan rbac:sync`.
     */
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('name', 64)->unique();          // slug, e.g. super_admin
            $table->string('display_name', 120);
            $table->string('description', 500)->nullable();
            $table->boolean('is_system')->default(false);   // system roles cannot be renamed or deleted
            $table->timestamps();
        });

        Schema::create('permissions', function (Blueprint $table) {
            $table->id();
            $table->string('name', 64)->unique();          // e.g. update_graduates (see App\Enums\Permission)
            $table->string('display_name', 120);
            $table->string('description', 500)->nullable();
            $table->string('group', 64)->index();          // module, e.g. graduates
            $table->timestamps();
        });

        Schema::create('permission_role', function (Blueprint $table) {
            $table->foreignId('role_id')->constrained()->cascadeOnDelete();
            $table->foreignId('permission_id')->constrained()->cascadeOnDelete();
            $table->primary(['role_id', 'permission_id']);
            $table->index('permission_id');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('role_id')->nullable()->after('password')->constrained()->restrictOnDelete();
            $table->boolean('is_active')->default(true)->after('role_id')->index();
            $table->timestamp('last_login_at')->nullable()->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('role_id');
            $table->dropIndex(['is_active']);
            $table->dropColumn(['is_active', 'last_login_at']);
        });
        Schema::dropIfExists('permission_role');
        Schema::dropIfExists('permissions');
        Schema::dropIfExists('roles');
    }
};
