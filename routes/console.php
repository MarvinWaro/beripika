<?php

use Illuminate\Support\Facades\Schedule;

/*
| Scheduler — add ONE cron entry on the server:
|   * * * * * cd /path/to/beripika && php artisan schedule:run >> /dev/null 2>&1
|
| On shared hosting without a long-running queue worker, the scheduler also drains
| the database queue every minute (imports and catalog sync).
*/
Schedule::command('app:work-queues')->everyMinute()->withoutOverlapping(3);
Schedule::command('graduates:prune-imports')->dailyAt('02:00');
