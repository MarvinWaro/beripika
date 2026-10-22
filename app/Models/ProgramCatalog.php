<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProgramCatalog extends Model
{
    // Laravel will automatically use the `program_catalogs` table

    protected $fillable = [
        'program_name',
        'normalized_name',
        'program_type',
        'notes',
    ];

    /**
     * Helper: normalize a program name consistently.
     */
    public static function normalizeName(string $name): string
    {
        // collapse multiple spaces, trim, uppercase
        $clean = preg_replace('/\s+/', ' ', trim($name));

        return mb_strtoupper($clean);
    }
}
