<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Background job bookkeeping:
     *  - catalog sync (portal programs -> program_catalogs), one row per school
     *  - SOAIS graduate imports, processed in 500-row chunks (read phase, then write phase)
     *
     * active_slot is a unique nullable flag so only one run of each kind can be active.
     */
    public function up(): void
    {
        Schema::create('catalog_sync_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedTinyInteger('active_slot')->nullable()->unique();
            $table->string('status', 20)->default('queued');
            $table->text('error')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
        });

        Schema::create('catalog_sync_schools', function (Blueprint $table) {
            $table->id();
            $table->foreignId('catalog_sync_run_id')->constrained()->cascadeOnDelete();
            $table->string('institution_code', 32);
            $table->string('institution_name');
            $table->string('status', 20)->default('queued');
            $table->unsignedInteger('created_count')->default(0);
            $table->text('error')->nullable();
            $table->timestamps();
            $table->unique(['catalog_sync_run_id', 'institution_code']);
            $table->index(['catalog_sync_run_id', 'status']);
        });

        Schema::create('graduate_imports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedTinyInteger('active_slot')->nullable()->unique();
            $table->string('filename');
            $table->string('path')->nullable();
            $table->string('sheet')->nullable();
            $table->string('status', 30)->default('queued');
            $table->string('phase', 20)->default('reading');
            $table->unsignedInteger('total_rows')->default(0);
            $table->text('error')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
        });

        Schema::create('graduate_import_chunks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('graduate_import_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('start_row');
            $table->unsignedInteger('end_row');
            $table->string('phase', 20)->default('reading');
            $table->string('status', 20)->default('queued');
            foreach (['created', 'updated', 'unchanged', 'skipped', 'invalid'] as $column) {
                $table->unsignedInteger($column)->default(0);
            }
            $table->text('error')->nullable();
            $table->timestamps();
            $table->unique(['graduate_import_id', 'start_row']);
            $table->index(['graduate_import_id', 'status']);
        });

        Schema::create('graduate_import_rows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('graduate_import_id')->constrained()->cascadeOnDelete();
            $table->foreignId('graduate_import_chunk_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('row_number');
            $table->char('identity_key', 64);
            $table->char('fingerprint', 64);
            $table->json('data');
            $table->unique(['graduate_import_id', 'row_number']);
            $table->index(['graduate_import_id', 'identity_key'], 'import_rows_identity');
        });

        Schema::create('graduate_import_issues', function (Blueprint $table) {
            $table->id();
            $table->foreignId('graduate_import_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('row_number');
            $table->string('severity', 10);
            $table->string('message', 500);
            $table->index(['graduate_import_id', 'row_number']);
        });
    }

    public function down(): void
    {
        foreach (['graduate_import_issues', 'graduate_import_rows', 'graduate_import_chunks', 'graduate_imports', 'catalog_sync_schools', 'catalog_sync_runs'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
