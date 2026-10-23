<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Graduates from the SOAIS masterlist.
     *
     * A graduate is identified by HEI UII + Special Order number (identity_key, sha256).
     * program_key / major_key / graduation_year are derived lookup columns maintained by
     * App\Services\GraduateData::indexes() whenever a row is saved or imported.
     */
    public function up(): void
    {
        Schema::create('graduates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('institution_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('program_id')->nullable()->constrained()->nullOnDelete();

            $table->string('hei_uii', 32)->nullable()->index();
            $table->string('so_number')->nullable()->index();
            $table->string('student_id_number')->nullable()->index();

            $table->string('last_name');
            $table->string('first_name');
            $table->string('middle_name')->nullable();
            $table->string('extension_name', 20)->nullable();
            $table->enum('sex', ['MALE', 'FEMALE'])->nullable();
            $table->date('date_of_birth')->nullable();

            $table->string('program_name', 500);                 // program as written in the masterlist
            $table->string('major', 500)->nullable();
            $table->string('psced_code', 32)->nullable()->index();
            $table->date('date_graduated');
            $table->string('academic_year', 20)->nullable();

            // Derived lookup keys
            $table->char('identity_key', 64)->nullable()->unique();
            $table->char('program_key', 64)->nullable();
            $table->char('major_key', 64)->nullable();
            $table->unsignedSmallInteger('graduation_year')->nullable()->index();

            $table->timestamps();

            $table->index(['hei_uii', 'program_key', 'major_key', 'graduation_year'], 'graduates_program_year_lookup');
            $table->index(['last_name', 'first_name', 'id'], 'graduates_name_order');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('graduates');
    }
};
