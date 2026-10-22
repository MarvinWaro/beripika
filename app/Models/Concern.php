<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Concern extends Model
{
    public const STATUSES = ['pending', 'in_progress', 'resolved', 'dismissed'];

    protected $fillable = ['institution_code', 'school', 'program', 'concern', 'status', 'resolved_by', 'resolved_at'];

    protected function casts(): array
    {
        return ['resolved_at' => 'datetime'];
    }

    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }
}
