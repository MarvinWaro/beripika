<?php

use App\Http\Controllers\ActivityLogController;
use App\Http\Controllers\ConcernController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\GraduateController;
use App\Http\Controllers\GraduateImportController;
use App\Http\Controllers\ImportController;
use App\Http\Controllers\InstitutionController;
use App\Http\Controllers\MapController;
use App\Http\Controllers\ProgramCatalogController;
use App\Http\Controllers\ProgramController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\WelcomeController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public
|--------------------------------------------------------------------------
| The public verification API (institution search, programs, permits, concerns)
| lives in routes/api.php.
*/
Route::get('/', [WelcomeController::class, 'index'])->name('home');
Route::get('/hei-map', [MapController::class, 'heiMap'])->middleware('throttle:60,1')->name('hei-map');

/*
|--------------------------------------------------------------------------
| Authenticated — every route is guarded by a permission (App\Enums\Permission)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth', 'verified'])->group(function () {

    // Dashboard
    // Without view_dashboard the controller forwards the user to the first module they can open.
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');
    Route::middleware('can:view_graduates')->group(function () {
        Route::get('dashboard/search', [DashboardController::class, 'searchGraduates'])->middleware('throttle:120,1')->name('dashboard.search');
        Route::get('dashboard/graduate/{id}', [DashboardController::class, 'getGraduateDetails'])->whereNumber('id')->name('dashboard.graduate.details');
    });

    // Institutions (portal)
    Route::prefix('institutions')->name('institutions.')->middleware('can:view_institutions')->group(function () {
        Route::get('/', [InstitutionController::class, 'index'])->name('index');
        Route::get('{instCode}/programs', [InstitutionController::class, 'programs'])
            ->where('instCode', '[A-Za-z0-9\-]+')->middleware('throttle:120,1')->name('programs');
        Route::get('{instCode}/programs/graduates', [InstitutionController::class, 'programGraduates'])
            ->where('instCode', '[A-Za-z0-9\-]+')->middleware('can:view_graduates')->name('programs.graduates');
    });

    // Programs & catalog
    Route::middleware('can:view_programs')->group(function () {
        Route::get('programs', [ProgramController::class, 'index'])->name('programs.index');
        Route::post('programs/refresh', [ProgramController::class, 'refresh'])->middleware('throttle:12,1')->name('programs.refresh');
        Route::get('programs/catalog', [ProgramCatalogController::class, 'index'])->name('programs.catalog.index');
    });
    Route::middleware('can:update_program_catalog')->group(function () {
        Route::post('programs/catalog/sync', [ProgramCatalogController::class, 'startSync'])->middleware('throttle:6,1')->name('programs.catalog.sync');
        Route::get('programs/catalog/sync/{run}', [ProgramCatalogController::class, 'syncStatus'])->middleware('throttle:60,1')->name('programs.catalog.sync-status');
        Route::patch('programs/catalog/{programCatalog}', [ProgramCatalogController::class, 'update'])->name('programs.catalog.update');
    });

    // Graduates
    Route::prefix('graduates')->name('graduates.')->group(function () {
        Route::get('/', [GraduateController::class, 'index'])->middleware('can:view_graduates')->name('index');
        Route::put('{graduate}', [GraduateController::class, 'update'])->middleware('can:update_graduates')->name('update');
        Route::delete('{graduate}', [GraduateController::class, 'destroy'])->middleware('can:delete_graduates')->name('destroy');
    });

    // Imports
    Route::prefix('import')->name('import.')->group(function () {
        Route::get('/', [ImportController::class, 'index'])->middleware('can:view_imports')->name('index');
        Route::post('institutions', [ImportController::class, 'importInstitutions'])->middleware('can:import_institutions')->name('institutions');
        Route::post('institutions/clear', [ImportController::class, 'clearInstitutions'])->middleware('can:clear_data')->name('institutions.clear');
        Route::post('graduates', [GraduateImportController::class, 'store'])->middleware(['can:import_graduates', 'throttle:6,1'])->name('graduates');
        Route::post('graduates/clear', [ImportController::class, 'clearGraduates'])->middleware('can:clear_data')->name('graduates.clear');
        Route::prefix('graduates/runs')->name('graduates.runs.')->middleware('can:import_graduates')->group(function () {
            Route::get('/', [GraduateImportController::class, 'index'])->name('index');
            Route::get('{run}', [GraduateImportController::class, 'show'])->middleware('throttle:60,1')->name('show');
            Route::post('{run}/retry', [GraduateImportController::class, 'retry'])->middleware('throttle:6,1')->name('retry');
            Route::post('{run}/process', [GraduateImportController::class, 'process'])->middleware('throttle:60,1')->name('process');
            Route::get('{run}/review', [GraduateImportController::class, 'review'])->middleware('throttle:60,1')->name('review');
            Route::get('{run}/issues', [GraduateImportController::class, 'issues'])->name('issues');
        });
    });

    // Concerns
    Route::get('concerns', [ConcernController::class, 'index'])->middleware('can:view_concerns')->name('concerns.index');
    Route::patch('concerns/{concern}', [ConcernController::class, 'update'])->middleware('can:update_concerns')->name('concerns.update');

    // Users
    Route::prefix('users')->name('users.')->group(function () {
        Route::get('/', [UserController::class, 'index'])->middleware('can:view_users')->name('index');
        Route::post('/', [UserController::class, 'store'])->middleware('can:create_users')->name('store');
        Route::put('{user}', [UserController::class, 'update'])->middleware('can:update_users')->name('update');
        Route::delete('{user}', [UserController::class, 'destroy'])->middleware('can:delete_users')->name('destroy');
        Route::patch('{user}/toggle-active', [UserController::class, 'toggleActive'])->middleware('can:toggle_user_active')->name('toggle-active');
    });

    // Roles & permissions
    Route::prefix('roles')->name('roles.')->middleware('can:manage_roles')->group(function () {
        Route::get('/', [RoleController::class, 'index'])->name('index');
        Route::post('/', [RoleController::class, 'store'])->name('store');
        Route::get('list', [RoleController::class, 'list'])->name('list');
        Route::get('permissions', [RoleController::class, 'permissions'])->name('permissions');
        Route::put('{role}', [RoleController::class, 'update'])->name('update');
        Route::delete('{role}', [RoleController::class, 'destroy'])->name('destroy');
        Route::post('{role}/duplicate', [RoleController::class, 'duplicate'])->name('duplicate');
    });

    // Activity logs
    Route::get('logs', [ActivityLogController::class, 'index'])->middleware('can:view_activity_logs')->name('logs.index');

    // Old admin URLs from the previous app
    Route::redirect('settings/users', '/users');
    Route::redirect('settings/roles', '/roles');
    Route::redirect('settings/import', '/import');
    Route::redirect('settings/concerns', '/concerns');
});

require __DIR__.'/settings.php';
