<?php

use App\Jobs\InitializeGraduateImport;
use App\Jobs\ProcessGraduateChunk;
use App\Models\Graduate;
use App\Models\GraduateImport;
use App\Models\Institution;
use App\Models\Program;
use App\Models\User;
use App\Services\GraduateImportService;
use App\Services\SoaisReader;
use Illuminate\Contracts\Queue\Job;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\Support\SoaisFixture;

uses(RefreshDatabase::class);

beforeEach(function () {
    Storage::fake('local');
    $this->realQueue = Queue::getFacadeRoot();
    Queue::fake();
    Cache::flush();
    $this->admin = User::factory()->superAdmin()->create();
});

function uploadSoais(array $rows, User $user, bool $xls = false): GraduateImport
{
    $path = tempnam(sys_get_temp_dir(), 'soais');
    SoaisFixture::make($path, $rows, $xls);
    try {
        return app(GraduateImportService::class)->start(new UploadedFile($path, $xls ? 'sample.xls' : 'sample.xlsx', null, null, true), $user->id);
    } finally {
        unlink($path);
    }
}

function runSoais(GraduateImport $run): void
{
    $service = app(GraduateImportService::class);
    $reader = app(SoaisReader::class);
    (new InitializeGraduateImport($run->id))->handle($service, $reader);
    foreach (['reading', 'writing'] as $phase) {
        foreach ($run->chunks()->where('phase', $phase)->where('status', 'queued')->get() as $chunk) {
            (new ProcessGraduateChunk($chunk->id, $phase))->handle($service, $reader);
        }
    }
}

test('xlsx and xls persist PSCED dates and stable identities', function ($xls) {
    $run = uploadSoais([SoaisFixture::row()], $this->admin, $xls);
    runSoais($run);
    $student = Graduate::sole();
    expect($student->psced_code)->toBe('464108')->and($student->date_graduated)->toBe('2024-06-01')
        ->and($student->graduation_year)->toBe(2024)->and($run->fresh()->status)->toBe('completed_with_issues');
    expect(app(GraduateImportService::class)->serialize($run->fresh())['counts']['created'])->toBe(1);
})->with([false, true]);

test('reupload updates mapped fields preserves absent fields and missing students', function () {
    $first = uploadSoais([SoaisFixture::row(), SoaisFixture::row('SO-2')], $this->admin);
    runSoais($first);
    $student = Graduate::where('so_number', 'SO-1')->first();
    $student->update(['date_of_birth' => '2000-01-01', 'student_id_number' => 'KEEP']);
    $second = uploadSoais([SoaisFixture::row('SO-1', 'Corrected')], $this->admin);
    runSoais($second);
    expect(Graduate::count())->toBe(2)->and($student->fresh()->first_name)->toBe('Corrected')
        ->and($student->fresh()->student_id_number)->toBe('KEEP')->and($student->fresh()->date_of_birth)->toBe('2000-01-01');
    $third = uploadSoais([SoaisFixture::row('SO-1', 'Corrected')], $this->admin);
    runSoais($third);
    expect(app(GraduateImportService::class)->serialize($third->fresh())['counts']['unchanged'])->toBe(1);
});

test('conflicting identities across chunks never write either row', function () {
    $rows = [SoaisFixture::row('SO-CONFLICT', 'First')];
    for ($i = 1; $i < 500; $i++) {
        $rows[] = [$i, 'XII'];
    }
    $rows[] = SoaisFixture::row('SO-CONFLICT', 'Different');
    $rows[] = SoaisFixture::row('SO-GOOD');
    $rows[] = SoaisFixture::row('SO-GOOD');
    $run = uploadSoais($rows, $this->admin);
    runSoais($run);
    expect(Graduate::count())->toBe(1)->and(Graduate::sole()->so_number)->toBe('SO-GOOD');
    expect(app(GraduateImportService::class)->serialize($run->fresh())['counts'])->toMatchArray(['created' => 1, 'invalid' => 2, 'skipped' => 500]);
});

test('invalid records are reported and exact program matching stays within institution and major', function () {
    $one = Institution::create(['institution_code' => '12001', 'name' => 'One', 'type' => 'Private']);
    $two = Institution::create(['institution_code' => '12002', 'name' => 'Two', 'type' => 'Private']);
    Program::create(['institution_id' => $two->id, 'program_name' => 'BS IT', 'major' => 'Networks', 'permit_number' => 'TEST']);
    $match = Program::create(['institution_id' => $one->id, 'program_name' => ' BS   IT ', 'major' => 'Networks', 'permit_number' => 'TEST']);
    $valid = SoaisFixture::row();
    $valid[12] = 'Networks';
    $invalid = SoaisFixture::row('SO-BAD');
    $invalid[15] = 'bad-date';
    $run = uploadSoais([$valid, $invalid], $this->admin);
    runSoais($run);
    expect(Graduate::sole()->program_id)->toBe($match->id);
    expect(DB::table('graduate_import_issues')->where('severity', 'error')->count())->toBe(1);
});

test('failed chunks resume without repeating successful writes or counters', function () {
    $run = uploadSoais([SoaisFixture::row()], $this->admin);
    $service = app(GraduateImportService::class);
    $reader = app(SoaisReader::class);
    (new InitializeGraduateImport($run->id))->handle($service, $reader);
    $chunk = $run->chunks()->first();
    (new ProcessGraduateChunk($chunk->id, 'reading'))->handle($service, $reader);
    (new ProcessGraduateChunk($chunk->id, 'writing'))->failed(new RuntimeException('Test failure'));
    expect($run->fresh()->status)->toBe('failed');
    $service->retry($run->fresh());
    $job = new ProcessGraduateChunk($chunk->id, 'writing');
    $job->handle($service, $reader);
    $job->handle($service, $reader);
    expect(Graduate::count())->toBe(1)->and(app(GraduateImportService::class)->serialize($run->fresh())['counts']['created'])->toBe(1);
});

test('active import blocks another start clearing and unauthorized endpoints', function () {
    $run = uploadSoais([SoaisFixture::row()], $this->admin);
    $this->actingAs($this->admin)->postJson('/import/graduates/clear')->assertConflict();
    $path = tempnam(sys_get_temp_dir(), 'soais');
    SoaisFixture::make($path, [SoaisFixture::row()]);
    $this->post('/import/graduates', ['file' => new UploadedFile($path, 'test.xlsx', null, null, true)], ['Accept' => 'application/json'])->assertConflict();
    unlink($path);
    $this->getJson('/import/graduates/runs')->assertOk()->assertJsonPath('active_id', $run->id);
    $this->actingAs(User::factory()->withRole('verifier')->create());
    $this->getJson('/import/graduates/runs')->assertForbidden();
    $this->getJson('/import/graduates/runs/'.$run->id)->assertForbidden();
    $this->getJson('/import/graduates/runs/'.$run->id.'/issues')->assertForbidden();
    $this->getJson('/import/graduates/runs/'.$run->id.'/review')->assertForbidden();
    $this->postJson('/import/graduates/runs/'.$run->id.'/process')->assertForbidden();
    $this->postJson('/import/graduates/runs/'.$run->id.'/retry')->assertForbidden();
});

test('browser processing consumes real reserved jobs without a separate worker and remains idempotent', function () {
    Queue::swap($this->realQueue);
    $run = uploadSoais([SoaisFixture::row()], $this->admin);
    $this->actingAs($this->admin)->postJson('/import/graduates/runs/'.$run->id.'/process')
        ->assertOk()->assertJsonPath('run.status', 'completed_with_issues')->assertJsonPath('run.counts.created', 1);
    $this->postJson('/import/graduates/runs/'.$run->id.'/process')->assertOk()->assertJsonPath('run.counts.created', 1);
    expect(Graduate::count())->toBe(1)->and(DB::table('jobs')->count())->toBe(0);
});

test('review notes are paginated and scoped to the selected import', function () {
    $rows = [];
    for ($i = 0; $i < 30; $i++) {
        $rows[] = SoaisFixture::row('SO-'.$i);
    }
    $run = uploadSoais($rows, $this->admin);
    runSoais($run);
    $other = uploadSoais([SoaisFixture::row('OTHER')], $this->admin);
    runSoais($other);
    $this->actingAs($this->admin)->getJson('/import/graduates/runs/'.$run->id.'/review')
        ->assertOk()->assertJsonPath('total', 30)->assertJsonCount(25, 'data')->assertJsonPath('data.0.row_number', 4);
    $this->getJson('/import/graduates/runs/'.$run->id.'/review?page=2')->assertOk()->assertJsonCount(5, 'data');
});

test('source cleanup retains unfinished imports and audit summaries', function () {
    $run = uploadSoais([SoaisFixture::row()], $this->admin);
    runSoais($run);
    $run->update(['finished_at' => now()->subDays(31)]);
    $pending = uploadSoais([SoaisFixture::row('SO-NEW')], $this->admin);
    $this->artisan('graduates:prune-imports')->assertSuccessful();
    expect($run->fresh()->path)->toBeNull()->and($pending->fresh()->path)->not->toBeNull();
    expect(DB::table('activity_logs')->where('action', 'graduates_import')->count())->toBe(1);
});

test('upload immediately returns a renderable queued response without processing students', function () {
    $path = tempnam(sys_get_temp_dir(), 'soais');
    SoaisFixture::make($path, [SoaisFixture::row()]);
    try {
        $this->actingAs($this->admin)->post('/import/graduates', ['file' => new UploadedFile($path, 'test.xlsx', null, null, true)], ['Accept' => 'application/json'])
            ->assertStatus(202)->assertJsonPath('run.total_rows', 0)->assertJsonPath('run.status', 'queued')
            ->assertJsonPath('run.counts.created', 0);
        expect(Graduate::count())->toBe(0);
        Queue::assertPushed(InitializeGraduateImport::class);
    } finally {
        unlink($path);
    }
});

test('invalid headers fail before any students are written', function () {
    $run = uploadSoais([SoaisFixture::row()], $this->admin);
    $path = Storage::disk('local')->path($run->path);
    $book = IOFactory::load($path);
    $book->getActiveSheet()->setCellValue('D2', 'Wrong template');
    (new Xlsx($book))->save($path);
    $book->disconnectWorksheets();
    expect(fn () => runSoais($run))->toThrow(RuntimeException::class, 'SOAIS template');
    expect(Graduate::count())->toBe(0)->and($run->chunks()->count())->toBe(0);
});

test('a surviving worker lock releases the delivery instead of silently losing pending work', function () {
    $run = uploadSoais([SoaisFixture::row()], $this->admin);
    $lock = Cache::lock('graduate-import:init:'.$run->id, 75);
    $lock->get();
    $delivery = Mockery::mock(Job::class);
    $delivery->shouldReceive('release')->once()->with(75);
    $job = new InitializeGraduateImport($run->id);
    $job->setJob($delivery);
    $job->handle(app(GraduateImportService::class), app(SoaisReader::class));
    $lock->release();
    expect($run->fresh()->status)->toBe('queued');
});

test('institution dialog paginates and filters exact program major and year', function () {
    $rows = [];
    for ($i = 0; $i < 27; $i++) {
        $row = SoaisFixture::row('SO-'.$i);
        $row[12] = 'Networks';
        $rows[] = $row;
    }
    $other = SoaisFixture::row('SO-OTHER');
    $other[12] = 'Security';
    $rows[] = $other;
    runSoais(uploadSoais($rows, $this->admin));
    $url = '/institutions/12001/programs/graduates?'.http_build_query(['program_name' => 'bs  it', 'major' => 'networks', 'year' => 2024]);
    $this->actingAs($this->admin)->getJson($url)->assertOk()->assertJsonCount(25, 'data')->assertJsonPath('total', 27);
    $this->getJson($url.'&page=2')->assertOk()->assertJsonCount(2, 'data');
    $this->getJson(str_replace('2024', '2025', $url))->assertOk()->assertJsonPath('total', 0);
});

test('1904 workbooks retain the same graduation date', function () {
    $run = uploadSoais([SoaisFixture::row()], $this->admin);
    $path = Storage::disk('local')->path($run->path);
    $book = IOFactory::load($path);
    Date::setExcelCalendar(Date::CALENDAR_MAC_1904);
    if (method_exists($book, 'setExcelCalendar')) {
        $book->setExcelCalendar(Date::CALENDAR_MAC_1904); // PhpSpreadsheet 2+
    }
    $book->getActiveSheet()->setCellValue('P4', 43982);
    (new Xlsx($book))->save($path);
    $book->disconnectWorksheets();
    Date::setExcelCalendar(Date::CALENDAR_WINDOWS_1900);
    runSoais($run);
    expect(Graduate::sole()->date_graduated)->toBe('2024-06-01');
});

test('truncated worksheet XML cannot be accepted as a partial successful import', function () {
    $run = uploadSoais([SoaisFixture::row()], $this->admin);
    $zip = new ZipArchive;
    $zip->open(Storage::disk('local')->path($run->path));
    $xml = $zip->getFromName('xl/worksheets/sheet1.xml');
    $zip->addFromString('xl/worksheets/sheet1.xml', substr($xml, 0, (int) (strlen($xml) / 2)));
    $zip->close();
    expect(fn () => runSoais($run))->toThrow(RuntimeException::class);
    expect(Graduate::count())->toBe(0)->and($run->chunks()->count())->toBe(0);
});

test('official multi-sheet workbook selects the SO Masterlist and ignores reference tabs', function () {
    $run = uploadSoais([SoaisFixture::row()], $this->admin);
    $path = Storage::disk('local')->path($run->path);
    $book = IOFactory::load($path);
    $book->getActiveSheet()->setTitle('SO Masterlist');
    $book->createSheet()->setTitle('Instructions')->setCellValue('A1', 'Instructions');
    $book->createSheet()->setTitle('Regions')->setCellValue('A1', 'Region XII');
    $book->createSheet()->setTitle('Programs')->setCellValue('A1', 'Reference values');
    (new Xlsx($book))->save($path);
    $book->disconnectWorksheets();

    runSoais($run);

    expect($run->fresh()->sheet)->toBe('SO Masterlist')
        ->and($run->fresh()->status)->toBe('completed_with_issues')
        ->and(Graduate::sole()->so_number)->toBe('SO-1');
});

test('multi-sheet workbook without a clearly named masterlist fails safely', function () {
    $run = uploadSoais([SoaisFixture::row()], $this->admin);
    $path = Storage::disk('local')->path($run->path);
    $book = IOFactory::load($path);
    $book->getActiveSheet()->setTitle('Data');
    $book->createSheet()->setTitle('Reference');
    (new Xlsx($book))->save($path);
    $book->disconnectWorksheets();

    expect(fn () => runSoais($run))->toThrow(RuntimeException::class, 'one SOAIS masterlist');
    expect(Graduate::count())->toBe(0);
});
