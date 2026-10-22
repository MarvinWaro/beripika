<?php

use App\Http\Controllers\ConcernController;
use App\Http\Controllers\PermitPdfProxyController;
use App\Http\Controllers\WelcomeController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public API (prefixed with /api, no authentication)
|--------------------------------------------------------------------------
*/
Route::middleware('throttle:60,1')->group(function () {
    Route::get('/institutions-list', [WelcomeController::class, 'getInstitutionsList'])->name('api.institutions-list');
    Route::post('/search-institution', [WelcomeController::class, 'searchInstitution'])->name('api.search-institution');
    Route::get('/institution/{instCode}/programs', [WelcomeController::class, 'getInstitutionPrograms'])
        ->where('instCode', '[A-Za-z0-9\-]+')->name('api.institution.programs');
    Route::get('/program/{programId}', [WelcomeController::class, 'getProgram'])->whereNumber('programId')->name('api.program');
    Route::post('/search-student', [WelcomeController::class, 'searchStudent'])->name('api.search-student');
    Route::post('/permit-pdf-proxy', [PermitPdfProxyController::class, 'proxy'])->name('permit.pdf.proxy');
});

// Stricter limit on writes from the public page.
Route::post('/concerns', [ConcernController::class, 'store'])->middleware('throttle:10,1')->name('api.concerns.store');
