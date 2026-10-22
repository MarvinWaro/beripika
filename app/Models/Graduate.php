<?php

namespace App\Models;

use App\Services\GraduateData;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Dates are stored as DATE columns and exposed as Y-m-d strings (no cast) so imported
 * rows compare 1:1 with the stored values during change detection.
 */
class Graduate extends Model
{
    protected static function booted(): void
    {
        static::saving(function (Graduate $graduate) {
            $graduate->forceFill(GraduateData::indexes($graduate->getAttributes()));
        });
    }

    protected $fillable = [
        'institution_id', 'program_id',
        'hei_uii', 'so_number', 'student_id_number',
        'last_name', 'first_name', 'middle_name', 'extension_name', 'sex', 'date_of_birth',
        'program_name', 'major', 'psced_code', 'date_graduated', 'academic_year',
    ];

    public function institution(): BelongsTo
    {
        return $this->belongsTo(Institution::class);
    }

    public function program(): BelongsTo
    {
        return $this->belongsTo(Program::class);
    }

    public function fullName(): string
    {
        return trim(implode(' ', array_filter([$this->first_name, $this->middle_name, $this->last_name, $this->extension_name])));
    }
}
