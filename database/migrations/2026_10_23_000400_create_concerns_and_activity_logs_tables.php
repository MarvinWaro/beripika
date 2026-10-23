<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Public "submit a concern" form on the welcome page.
        Schema::create('concerns', function (Blueprint $table) {
            $table->id();
            $table->string('institution_code', 32)->nullable()->index();
            $table->string('school');
            $table->string('program');
            $table->text('concern');
            $table->string('status', 20)->default('pending')->index(); // pending, in_progress, resolved, dismissed
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
            $table->index('created_at');
        });

        // Audit trail.
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action', 64);
            $table->nullableMorphs('subject');
            $table->string('summary', 1000);
            $table->json('properties')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->timestamps();
            $table->index(['action', 'created_at']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
        Schema::dropIfExists('concerns');
    }
};
