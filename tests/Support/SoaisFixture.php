<?php

namespace Tests\Support;

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xls;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

class SoaisFixture
{
    public static function make(string $path, array $rows, bool $xls = false): void
    {
        $book = new Spreadsheet;
        $sheet = $book->getActiveSheet();
        $sheet->setTitle('SOAIS');
        $sheet->setCellValue('A1', 'MASTERLIST OF APPROVED SPECIAL ORDER APPLICATIONS');
        $sheet->fromArray(['No.', 'Region', 'HEI NAME', 'HEI UII', 'Special Order Number', 'Last Name', 'First Name', 'Middle Name', 'Extension Name', 'Sex', 'Program', 'PSCED Code', 'Major', 'Started', '', 'Ended'], null, 'A2');
        $sheet->setCellValue('P3', 'Date of Graduation');
        $sheet->setCellValue('R3', 'Academic Year');
        $sheet->fromArray($rows, null, 'A4');
        ($xls ? new Xls($book) : new Xlsx($book))->save($path);
        $book->disconnectWorksheets();
    }

    public static function row(string $so = 'SO-1', string $first = 'Student'): array
    {
        return [1, 'XII', 'Example College', '12001', $so, 'Example', $first, '', '', 'Female', 'BS IT', '464108', '', '', '', 45444, '', '2023-2024'];
    }
}
