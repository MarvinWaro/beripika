<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Local copy of HEIs and their authorized programs (from the institutions import).
     * The CHED portal remains the live source for the HEI list; these rows are used to
     * link graduates to a specific permit/program.
     */
    public function up(): void
    {
        Schema::create('institutions', function (Blueprint $table) {
            $table->id();
            $table->string('institution_code', 32)->unique();   // HEI UII (portal instCode)
            $table->string('name');
            $table->string('type', 20)->nullable();             // Private, SUCs, LUCs
            $table->timestamps();
        });

        Schema::create('programs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('institution_id')->constrained()->cascadeOnDelete();
            $table->string('program_name', 500);
            $table->string('major', 500)->nullable();
            $table->string('program_type', 20)->nullable();      // Board, Non-Board
            $table->string('permit_number')->nullable();
            $table->timestamps();
            $table->index(['institution_id', 'program_name'], 'programs_institution_name');
        });

        Schema::create('program_catalogs', function (Blueprint $table) {
            $table->id();
            $table->string('program_name', 500);
            $table->string('normalized_name', 500)->unique();
            $table->string('program_type', 20)->default('Unknown')->index(); // Board, Non-Board, Unknown
            $table->string('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('program_catalogs');
        Schema::dropIfExists('programs');
        Schema::dropIfExists('institutions');
    }
};
