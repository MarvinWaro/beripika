<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Program extends Model
{
    protected $fillable = ['institution_id', 'program_name', 'major', 'program_type', 'permit_number'];

    public function institution(): BelongsTo
    {
        return $this->belongsTo(Institution::class);
    }

    public function graduates(): HasMany
    {
        return $this->hasMany(Graduate::class);
    }
}
