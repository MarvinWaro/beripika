<?php

namespace App\Services;

use DateTimeImmutable;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\Shared\Date;
use RuntimeException;

class GraduateData
{
    public static function normalized(?string $value): string
    {
        return mb_strtoupper(preg_replace('/\s+/u', ' ', trim($value ?? '')));
    }

    public static function identity(?string $hei, ?string $so): ?string
    {
        return self::normalized($hei) === '' || self::normalized($so) === '' ? null
            : hash('sha256', json_encode([self::normalized($hei), self::normalized($so)]));
    }

    public static function nameKey(?string $value): string
    {
        return hash('sha256', self::normalized($value));
    }

    public static function date(mixed $value): string
    {
        if ($value instanceof \DateTimeInterface) {
            return $value->format('Y-m-d');
        }
        if (is_numeric($value) && (float) $value > 0 && (float) $value < 200000) {
            $calendar = Date::getExcelCalendar();
            try {
                Date::setExcelCalendar(Date::CALENDAR_WINDOWS_1900);

                return Date::excelToDateTimeObject((float) $value)->format('Y-m-d');
            } finally {
                Date::setExcelCalendar($calendar);
            }
        }
        $text = trim((string) $value);
        foreach (['Y-m-d', 'Y/m/d', 'm/d/Y', 'F j, Y', 'M j, Y'] as $format) {
            $date = DateTimeImmutable::createFromFormat('!'.$format, $text);
            $errors = DateTimeImmutable::getLastErrors();
            if ($date && (! $errors || (! $errors['warning_count'] && ! $errors['error_count']))) {
                return $date->format('Y-m-d');
            }
        }
        throw new RuntimeException($text === ''
            ? 'Missing or invalid graduation date. Use an Excel date or YYYY/MM/DD.'
            : sprintf('Missing or invalid graduation date (found "%s"). Use an Excel date or YYYY/MM/DD.', Str::limit($text, 30)));
    }

    public static function indexes(array $data): array
    {
        preg_match('/\b(\d{4})\b/', (string) ($data['date_graduated'] ?? ''), $year);

        return [
            'identity_key' => self::identity($data['hei_uii'] ?? null, $data['so_number'] ?? null),
            'program_key' => self::nameKey($data['program_name'] ?? null),
            'major_key' => self::nameKey($data['major'] ?? null),
            'graduation_year' => isset($year[1]) ? (int) $year[1] : null,
        ];
    }
}
