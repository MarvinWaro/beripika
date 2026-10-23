<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Institution extends Model
{
    protected $fillable = ['institution_code', 'name', 'type'];

    public function programs(): HasMany
    {
        return $this->hasMany(Program::class);
    }

    public function graduates(): HasMany
    {
        return $this->hasMany(Graduate::class);
    }
}
