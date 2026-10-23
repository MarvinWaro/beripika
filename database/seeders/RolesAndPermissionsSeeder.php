<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Artisan;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        Artisan::call('rbac:sync');
    }
}
