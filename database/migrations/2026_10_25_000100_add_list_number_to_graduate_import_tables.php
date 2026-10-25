<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Masterlist "No." (column A) so review notes can point at the number staff see in Excel.
     * Kept outside graduate_import_rows.data: that JSON feeds the graduate upsert and the
     * duplicate-conflict fingerprint, and the No. differs between otherwise identical rows.
     */
    public function up(): void
    {
        Schema::table('graduate_import_rows', function (Blueprint $table) {
            $table->string('list_number', 20)->nullable()->after('row_number');
        });
        Schema::table('graduate_import_issues', function (Blueprint $table) {
            $table->string('list_number', 20)->nullable()->after('row_number');
        });
    }

    public function down(): void
    {
        Schema::table('graduate_import_issues', function (Blueprint $table) {
            $table->dropColumn('list_number');
        });
        Schema::table('graduate_import_rows', function (Blueprint $table) {
            $table->dropColumn('list_number');
        });
    }
};
