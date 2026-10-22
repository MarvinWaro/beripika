<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class ActivityLog extends Model
{
    protected $fillable = ['user_id', 'action', 'subject_type', 'subject_id', 'summary', 'properties', 'ip_address', 'user_agent'];

    protected function casts(): array
    {
        return ['properties' => 'array'];
    }

    protected static function booted(): void
    {
        // Capture request context automatically for web actions (queued jobs have none).
        static::creating(function (ActivityLog $log) {
            $log->summary = Str::limit((string) $log->summary, 1000, '');
            if (app()->runningInConsole() || ! app()->bound('request')) {
                return;
            }
            $request = request();
            $log->ip_address ??= $request->ip();
            $log->user_agent ??= Str::limit((string) $request->userAgent(), 255, '');
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Convenience writer used across controllers. */
    public static function record(string $action, string $summary, ?Model $subject = null, array $properties = [], ?int $userId = null): self
    {
        return self::create([
            'user_id' => $userId ?? auth()->id(),
            'action' => $action,
            'subject_type' => $subject ? $subject::class : null,
            'subject_id' => $subject?->getKey(),
            'summary' => $summary,
            'properties' => $properties ?: null,
        ]);
    }
}
