<?php

namespace App\Providers;

use App\Enums\Permission;
use App\Models\ActivityLog;
use App\Models\Graduate;
use App\Models\User;
use App\Policies\ConcernPolicy;
use App\Policies\GraduatePolicy;
use App\Policies\ImportPolicy;
use App\Policies\UserPolicy;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;
use Illuminate\Foundation\DevCommands;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        $this->configureDefaults();
        $this->configureAuthorization();
        $this->configureAuditEvents();

        // `composer run dev`: the worker must also listen on the "imports" queue used by SOAIS uploads.
        if ($this->app->runningInConsole() && class_exists(DevCommands::class)) {
            DevCommands::artisan('queue:listen database --queue=default,imports --tries=1 --timeout=45', 'queue');
        }
    }

    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }

    /**
     * Every Permission enum value is a Gate ability, so routes can use ->can('view_graduates')
     * and controllers Gate::authorize('view_graduates'). Model policies add record rules.
     */
    protected function configureAuthorization(): void
    {
        Gate::policy(User::class, UserPolicy::class);
        Gate::policy(Graduate::class, GraduatePolicy::class);

        foreach (Permission::cases() as $permission) {
            Gate::define($permission->value, fn (User $user) => $user->hasPermission($permission));
        }

        // Named abilities kept from the original app.
        Gate::define('viewImports', [ImportPolicy::class, 'viewAny']);
        Gate::define('importInstitutions', [ImportPolicy::class, 'importInstitutions']);
        Gate::define('importGraduates', [ImportPolicy::class, 'importGraduates']);
        Gate::define('clearData', [ImportPolicy::class, 'clearData']);
        Gate::define('viewConcerns', [ConcernPolicy::class, 'viewAny']);
        Gate::define('updateConcerns', [ConcernPolicy::class, 'update']);
        Gate::define('viewActivityLogs', fn (User $user) => $user->hasPermission(Permission::VIEW_ACTIVITY_LOGS));
    }

    protected function configureAuditEvents(): void
    {
        Event::listen(Login::class, function (Login $event) {
            if (! $event->user instanceof User) {
                return;
            }
            $event->user->forceFill(['last_login_at' => now()])->saveQuietly();
            ActivityLog::record('login', $event->user->name.' signed in', $event->user, userId: $event->user->id);
        });

        Event::listen(Logout::class, function (Logout $event) {
            if ($event->user instanceof User) {
                ActivityLog::record('logout', $event->user->name.' signed out', $event->user, userId: $event->user->id);
            }
        });
    }
}
