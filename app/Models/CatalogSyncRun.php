<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CatalogSyncRun extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return ['finished_at' => 'datetime'];
    }

    public function schools(): HasMany
    {
        return $this->hasMany(CatalogSyncSchool::class);
    }
}
