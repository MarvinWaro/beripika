<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GraduateImport extends Model
{
    protected $guarded = [];

    protected $casts = ['finished_at' => 'datetime'];

    public function chunks(): HasMany
    {
        return $this->hasMany(GraduateImportChunk::class);
    }
}
