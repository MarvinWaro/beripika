<?php

namespace App\Services;

use Generator;
use RuntimeException;
use XMLReader;
use ZipArchive;

/** Bounded XLSX reader: worksheet XML and shared strings never form a workbook-sized DOM. */
class SoaisXlsxStream
{
    private function open(string $path, string $entry): XMLReader
    {
        $reader = new XMLReader;
        if (! $reader->open('zip://'.str_replace('\\', '/', realpath($path)).'#'.$entry, null, LIBXML_NONET)) {
            throw new RuntimeException('Could not open worksheet XML.');
        }

        return $reader;
    }

    private function xml(string $text): \SimpleXMLElement
    {
        if (stripos($text, '<!DOCTYPE') !== false || stripos($text, '<!ENTITY') !== false) {
            throw new RuntimeException('Unsupported XML declarations in spreadsheet.');
        }
        $xml = simplexml_load_string($text, \SimpleXMLElement::class, LIBXML_NONET);
        if (! $xml) {
            throw new RuntimeException('Invalid spreadsheet XML.');
        }

        return $xml;
    }

    public function prepare(string $path, string $directory): array
    {
        $previous = libxml_use_internal_errors(true);
        libxml_clear_errors();
        try {
            $result = $this->prepareWorkbook($path, $directory);
            foreach (libxml_get_errors() as $error) {
                if ($error->level >= LIBXML_ERR_ERROR) {
                    throw new RuntimeException('Invalid or incomplete worksheet XML.');
                }
            }

            return $result;
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
        }
    }

    private function prepareWorkbook(string $path, string $directory): array
    {
        $zip = new ZipArchive;
        if ($zip->open($path) !== true) {
            throw new RuntimeException('Invalid XLSX file.');
        }
        $size = 0;
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $size += $zip->statIndex($i)['size'];
        }
        if ($size > 512 * 1024 * 1024) {
            throw new RuntimeException('The expanded workbook exceeds the 512 MB processing limit.');
        }
        $workbook = $this->xml($zip->getFromName('xl/workbook.xml'));
        $sheets = $workbook->xpath('//*[local-name()="sheet"]');
        if (count($sheets) === 0) {
            throw new RuntimeException('The workbook does not contain a worksheet.');
        }
        $candidates = count($sheets) === 1
            ? $sheets
            : array_values(array_filter($sheets, fn ($candidate) => $this->isMasterlistName((string) $candidate['name'])));
        if (count($candidates) !== 1) {
            throw new RuntimeException('Could not identify one SOAIS masterlist tab. Keep a single worksheet named "SO Masterlist".');
        }
        $sheet = $candidates[0];
        $properties = $workbook->xpath('//*[local-name()="workbookPr"]');
        $date1904 = isset($properties[0]) && in_array((string) $properties[0]['date1904'], ['1', 'true'], true);
        $attrs = $sheet->attributes('http://schemas.openxmlformats.org/officeDocument/2006/relationships');
        $relations = $this->xml($zip->getFromName('xl/_rels/workbook.xml.rels'));
        $entry = null;
        foreach ($relations->xpath('//*[local-name()="Relationship"]') as $rel) {
            if ((string) $rel['Id'] === (string) $attrs['id']) {
                $target = (string) $rel['Target'];
                if (str_contains($target, '..') || str_contains($target, ':')) {
                    throw new RuntimeException('Unsupported worksheet path.');
                }
                $entry = str_starts_with($target, '/') ? ltrim($target, '/') : 'xl/'.$target;
            }
        }
        if (! $entry) {
            throw new RuntimeException('Worksheet not found.');
        }
        if (! is_dir($directory) && ! mkdir($directory, 0700, true)) {
            throw new RuntimeException('Cannot prepare import storage.');
        }
        $strings = fopen($directory.'/strings.bin', 'w+b');
        $index = fopen($directory.'/strings.idx', 'w+b');
        if (! $strings || ! $index) {
            throw new RuntimeException('Cannot prepare shared strings.');
        }
        $chunkFile = null;
        $headers = [];
        $last = 0;
        $chunkStart = null;
        try {
            if ($zip->locateName('xl/sharedStrings.xml') !== false) {
                $reader = $this->open($path, 'xl/sharedStrings.xml');
                try {
                    while ($reader->read()) {
                        if ($reader->nodeType === XMLReader::DOC_TYPE) {
                            throw new RuntimeException('Unsupported XML declarations.');
                        }
                        if ($reader->nodeType !== XMLReader::ELEMENT || $reader->localName !== 'si') {
                            continue;
                        }
                        $item = $this->xml($reader->readOuterXml());
                        $text = implode('', array_map('strval', $item->xpath('//*[local-name()="t"]')));
                        fwrite($index, pack('P', ftell($strings)));
                        fwrite($strings, pack('V', strlen($text)).$text);
                    }
                } finally {
                    $reader->close();
                }
            }
            foreach ($this->rows($path, $entry, $strings, $index) as $number => $row) {
                if ($number <= $last || $number > 250003) {
                    throw new RuntimeException('Invalid row order or more than 250,000 template rows.');
                }
                $last = $number;
                if ($number < 4) {
                    $headers[$number] = $row;

                    continue;
                }
                if ($date1904 && is_numeric($row[15] ?? null)) {
                    $row[15] = (float) $row[15] + 1462;
                }
                $start = 4 + intdiv($number - 4, 500) * 500;
                if ($chunkStart !== $start) {
                    if ($chunkFile) {
                        fclose($chunkFile);
                    }
                    $chunkFile = fopen($directory.'/'.$start.'.jsonl', 'wb');
                    if (! $chunkFile) {
                        throw new RuntimeException('Cannot store prepared rows.');
                    }
                    $chunkStart = $start;
                }
                $line = json_encode([$number, $row], JSON_THROW_ON_ERROR)."\n";
                if (fwrite($chunkFile, $line) !== strlen($line)) {
                    throw new RuntimeException('Insufficient space for prepared rows.');
                }
            }

            return ['sheet' => (string) $sheet['name'], 'last_row' => $last, 'headers' => $headers];
        } finally {
            if ($chunkFile) {
                fclose($chunkFile);
            }
            fclose($strings);
            fclose($index);
            $zip->close();
            unlink($directory.'/strings.bin');
            unlink($directory.'/strings.idx');
        }
    }

    private function isMasterlistName(string $name): bool
    {
        $normalized = preg_replace('/[^A-Z0-9]+/', ' ', mb_strtoupper(trim($name)));

        return preg_match('/\bSO\s*MASTERLIST\b/', $normalized) === 1;
    }

    private function rows(string $path, string $entry, $strings, $index): Generator
    {
        $reader = $this->open($path, $entry);
        try {
            $hasNode = $reader->read();
            while ($hasNode) {
                if ($reader->nodeType === XMLReader::DOC_TYPE) {
                    throw new RuntimeException('Unsupported XML declarations.');
                }
                if ($reader->nodeType !== XMLReader::ELEMENT || $reader->localName !== 'row') {
                    $hasNode = $reader->read();

                    continue;
                }
                $number = (int) $reader->getAttribute('r');
                $row = array_fill(0, 18, null);
                $xml = $this->xml($reader->readOuterXml());
                foreach ($xml->c as $cell) {
                    preg_match('/^([A-Z]+)\d+$/', (string) $cell['r'], $address);
                    $column = $address[1] ?? '';
                    if (strlen($column) !== 1 || $column < 'A' || $column > 'R') {
                        continue;
                    }
                    $value = isset($cell->v) ? (string) $cell->v : null;
                    if ((string) $cell['t'] === 's') {
                        if ($value === null || ! ctype_digit($value)) {
                            throw new RuntimeException('Invalid shared string reference.');
                        }
                        fseek($index, (int) $value * 8);
                        $offset = fread($index, 8);
                        if (strlen($offset) !== 8) {
                            throw new RuntimeException('Missing shared string.');
                        }
                        fseek($strings, unpack('P', $offset)[1]);
                        $length = unpack('V', fread($strings, 4))[1];
                        $value = $length ? fread($strings, $length) : '';
                    } elseif ((string) $cell['t'] === 'inlineStr') {
                        $value = isset($cell->is->t) ? (string) $cell->is->t
                            : implode('', array_map('strval', $cell->xpath('.//*[local-name()="t"]')));
                    }
                    $row[ord($column) - 65] = $value;
                }
                yield $number => $row;
                // The row was parsed above; do not visit every cell again through XMLReader.
                $hasNode = $reader->next();
            }
        } finally {
            $reader->close();
        }
    }
}
