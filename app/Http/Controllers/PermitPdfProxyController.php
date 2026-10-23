<?php

// app/Http/Controllers/PermitPdfProxyController.php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PermitPdfProxyController extends Controller
{
    /**
     * Proxy PDF requests to hide the actual URL and add authentication.
     *
     * Handles known portal quirks:
     *  - Brotli (br) encoding → disable Accept-Encoding so cURL won't choke
     *  - Leading whitespace before %PDF magic bytes → trim it
     *  - Some files return 1-byte body (portal has no file) → treat as missing
     */
    public function proxy(Request $request)
    {
        $request->validate([
            'url' => 'required|url',
        ]);

        $pdfUrl = $request->input('url');

        // Only proxy documents from the configured CHED portal (prevents using this endpoint to fetch arbitrary URLs).
        $allowedHost = parse_url((string) config('services.portal.permit_base_url'), PHP_URL_HOST);
        if (! $allowedHost || strcasecmp((string) parse_url($pdfUrl, PHP_URL_HOST), $allowedHost) !== 0
            || parse_url($pdfUrl, PHP_URL_SCHEME) !== 'https') {
            return response()->json(['error' => 'Unsupported document URL'], 422);
        }

        $apiKey = (string) config('services.portal.key');

        if ($apiKey === '') {
            Log::error('PORTAL_API key is missing in .env');

            return response()->json(['error' => 'Server configuration error'], 500);
        }

        $cacheKey = 'pdf_proxy_'.md5($pdfUrl);

        try {
            // Binary PDFs are stored base64-encoded: the database cache store only accepts valid UTF-8 text.
            $cachedPdf = Cache::remember($cacheKey, 600, function () use ($pdfUrl, $apiKey) {
                $pdf = $this->fetchPdfFromPortal($pdfUrl, $apiKey);

                return $pdf ? ['body' => base64_encode($pdf['body']), 'size' => $pdf['size']] : null;
            });

            // Failed or empty / too-small body → not a real PDF
            if (! $cachedPdf || $cachedPdf['size'] < 100) {
                Cache::forget($cacheKey);

                // Return a JSON error with the direct URL so frontend can fallback
                return response()->json([
                    'error' => 'PDF not available through proxy',
                    'direct_url' => $pdfUrl,
                ], 502);
            }

            return response(base64_decode($cachedPdf['body']))
                ->header('Content-Type', 'application/pdf')
                ->header('Content-Disposition', 'inline; filename="permit.pdf"')
                ->header('Content-Length', (string) $cachedPdf['size'])
                ->header('Cache-Control', 'public, max-age=600')
                ->header('X-Content-Type-Options', 'nosniff');

        } catch (\Exception $e) {
            Log::error('Exception while proxying PDF', [
                'url' => $pdfUrl,
                'error' => $e->getMessage(),
            ]);

            Cache::forget($cacheKey);

            return response()->json([
                'error' => 'Failed to fetch PDF',
                'direct_url' => $pdfUrl,
            ], 502);
        }
    }

    /**
     * Attempt to fetch the PDF, working around portal encoding issues.
     */
    protected function fetchPdfFromPortal(string $pdfUrl, string $apiKey): ?array
    {
        // ── Attempt 1: Normal request with explicit Accept-Encoding ──────
        // Tell the server we only accept encodings PHP/cURL can handle
        // (avoids cURL error 61 when portal responds with Brotli)
        $body = $this->tryFetch($pdfUrl, $apiKey, 'gzip, deflate');

        // ── Attempt 2: Request with identity encoding (no compression) ───
        if ($body === null) {
            $body = $this->tryFetch($pdfUrl, $apiKey, 'identity');
        }

        if ($body === null) {
            return null;
        }

        // Some portal PDFs have leading whitespace before the %PDF header.
        // Trim any bytes before the actual PDF signature so react-pdf can parse it.
        $pdfStart = strpos($body, '%PDF');
        if ($pdfStart !== false && $pdfStart > 0 && $pdfStart < 20) {
            $body = substr($body, $pdfStart);
        }

        $size = strlen($body);

        // Portal sometimes returns a 200 with a 1-byte body when the file doesn't exist
        if ($size < 100) {
            Log::warning('PDF response too small', ['url' => $pdfUrl, 'size' => $size]);

            return null;
        }

        return ['body' => $body, 'size' => $size];
    }

    /**
     * Single HTTP attempt with the given Accept-Encoding value.
     */
    protected function tryFetch(string $url, string $apiKey, string $acceptEncoding): ?string
    {
        try {
            $response = Http::withHeaders([
                'PORTAL-API' => $apiKey,
                'Accept' => 'application/pdf, */*',
                'Accept-Encoding' => $acceptEncoding,
                'User-Agent' => 'Beripika/1.0',
            ])
                ->withOptions([
                    // Prevent cURL from advertising encodings it can't decode
                    'decode_content' => true,
                ])
                ->timeout(30)
                ->retry(2, 500)
                ->get($url);

            if (! $response->successful()) {
                Log::warning('PDF fetch failed', [
                    'url' => $url,
                    'status' => $response->status(),
                    'encoding' => $acceptEncoding,
                ]);

                return null;
            }

            return $response->body();
        } catch (\Exception $e) {
            Log::warning('PDF fetch exception', [
                'url' => $url,
                'encoding' => $acceptEncoding,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }
}
