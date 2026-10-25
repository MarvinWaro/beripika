<?php

namespace App\Services;

use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Reader\IReadFilter;
use PhpOffice\PhpSpreadsheet\Reader\Xlsx;
use PhpOffice\PhpSpreadsheet\Shared\Date;
use RuntimeException;

class SoaisReader
{
    public function metadata(string $path): array
    {
        $reader = IOFactory::createReaderForFile($path);
        if ($reader instanceof Xlsx) {
            $prepared = app(SoaisXlsxStream::class)->prepare($path, $path.'.parts');
            $this->validateHeaders($prepared['headers']);
            if ($prepared['last_row'] < 4) {
                throw new RuntimeException('The worksheet has no data rows.');
            }

            return ['sheet' => $prepared['sheet'], 'last_row' => $prepared['last_row']];
        }
        $info = $reader->listWorksheetInfo($path);
        $candidates = count($info) === 1
            ? $info
            : array_values(array_filter($info, fn ($sheet) => preg_match('/\bSO\s*MASTERLIST\b/', preg_replace('/[^A-Z0-9]+/', ' ', mb_strtoupper(trim($sheet['worksheetName'])))) === 1));
        if (count($candidates) !== 1) {
            throw new RuntimeException('Could not identify one SOAIS masterlist tab. Keep a single worksheet named "SO Masterlist".');
        }
        $sheet = $candidates[0]['worksheetName'];
        $rows = $this->rows($path, $sheet, 1, 3);
        $this->validateHeaders($rows);
        if ($candidates[0]['totalRows'] < 4) {
            throw new RuntimeException('The worksheet has no data rows.');
        }

        return ['sheet' => $sheet, 'last_row' => $candidates[0]['totalRows']];
    }

    private function validateHeaders(array $rows): void
    {
        $expected = [3 => 'HEI UII', 4 => 'Special Order Number', 5 => 'Last Name', 6 => 'First Name', 7 => 'Middle Name',
            8 => 'Extension Name', 9 => 'Sex', 10 => 'Program', 11 => 'PSCED Code', 12 => 'Major'];
        foreach ($expected as $index => $heading) {
            if (! str_starts_with(GraduateData::normalized((string) ($rows[2][$index] ?? '')), GraduateData::normalized($heading))) {
                throw new RuntimeException('The worksheet does not match the SOAIS template. Check the headers in rows 2 and 3.');
            }
        }
        if (! str_starts_with(GraduateData::normalized((string) ($rows[3][15] ?? '')), 'DATE OF GRADUATION')
            || ! str_starts_with(GraduateData::normalized((string) ($rows[3][17] ?? '')), 'ACADEMIC YEAR')) {
            throw new RuntimeException('SOAIS graduation date and academic year headers are missing.');
        }
    }

    public function rows(string $path, string $sheet, int $start, int $end): array
    {
        $reader = IOFactory::createReaderForFile($path);
        if ($reader instanceof Xlsx && $start >= 4) {
            if (! is_dir($path.'.parts')) {
                throw new RuntimeException('Prepared spreadsheet rows are missing.');
            }
            $rows = array_fill_keys(range($start, $end), array_fill(0, 18, null));
            $file = $path.'.parts/'.$start.'.jsonl';
            if (! is_file($file)) {
                return $rows;
            }
            $stream = fopen($file, 'rb');
            try {
                while (($line = fgets($stream)) !== false) {
                    [$number, $row] = json_decode($line, true, 512, JSON_THROW_ON_ERROR);
                    $rows[$number] = $row;
                }
            } finally {
                fclose($stream);
            }

            return $rows;
        }
        $reader->setReadDataOnly(true);
        $reader->setLoadSheetsOnly([$sheet]);
        $reader->setReadFilter(new class($start, $end) implements IReadFilter
        {
            public function __construct(private int $start, private int $end) {}

            public function readCell($columnAddress, $row, $worksheetName = ''): bool
            {
                return $row >= $this->start && $row <= $this->end && in_array($columnAddress, range('A', 'R'), true);
            }
        });
        $book = $reader->load($path);
        try {
            $values = $book->getSheetByName($sheet)->rangeToArray("A{$start}:R{$end}", null, false, false);
            foreach ($values as &$row) {
                if (is_numeric($row[15] ?? null)) {
                    $row[15] = Date::excelToDateTimeObject((float) $row[15])->format('Y-m-d');
                }
            }

            return array_combine(range($start, $end), $values);
        } finally {
            $book->disconnectWorksheets();
            unset($book);
        }
    }

    public function normalize(array $row): ?array
    {
        $value = fn (int $index) => trim((string) ($row[$index] ?? ''));
        // Numbering, region and school labels in otherwise unused template rows are not students.
        if (collect([3, 4, 5, 6, 10])->every(fn ($index) => $value($index) === '')) {
            return null;
        }
        foreach ([3, 4, 5, 6, 10] as $index) {
            if ($value($index) === '') {
                throw new RuntimeException('Missing required HEI UII, SO number, name or program.');
            }
        }
        foreach ([3, 4, 5, 6, 7, 8, 11] as $index) {
            if (mb_strlen($value($index)) > 255) {
                throw new RuntimeException('An identity or name field exceeds 255 characters.');
            }
        }
        $sex = match (strtoupper($value(9))) {
            'M', 'MALE' => 'MALE', 'F', 'FEMALE' => 'FEMALE', '' => null,
            default => throw new RuntimeException(sprintf('Sex must be Male or Female, or blank (found "%s").', Str::limit($value(9), 30)))
        };
        $data = ['hei_uii' => $value(3), 'so_number' => $value(4), 'last_name' => $value(5), 'first_name' => $value(6),
            'middle_name' => $value(7) ?: null, 'extension_name' => $value(8) ?: null, 'sex' => $sex,
            'program_name' => $value(10), 'psced_code' => $value(11) ?: null, 'major' => $value(12) ?: null,
            'date_graduated' => GraduateData::date($row[15] ?? null), 'academic_year' => $value(17) ?: null];
        if (mb_strlen($value(17)) > 255) {
            throw new RuntimeException('Academic year exceeds 255 characters.');
        }

        return $data + GraduateData::indexes($data);
    }
}
