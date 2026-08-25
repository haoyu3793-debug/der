<#
.SYNOPSIS
    Tiny zero-dependency static file server for the Phoenix Park Deer Tracker.

.DESCRIPTION
    Serves the script's directory over HTTP using .NET HttpListener.
    Just PowerShell - nothing to install.

    For a shareable PUBLIC URL, run share.ps1 instead (it wraps this with a
    Cloudflare Quick Tunnel).

.PARAMETER Port
    Port to listen on. Default 8080.

.EXAMPLE
    .\serve.ps1
    .\serve.ps1 -Port 9000
#>
param([int]$Port = 8080)

Add-Type -AssemblyName System.Web

$root = $PSScriptRoot
$listener = [System.Net.HttpListener]::new()
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    Write-Host "Could not bind to $prefix" -ForegroundColor Red
    Write-Host "Is something else using port $Port? Try: .\serve.ps1 -Port 8081" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Phoenix Park Deer Tracker - local server" -ForegroundColor Green
Write-Host "Serving:    $root" -ForegroundColor Gray
Write-Host "Local URL:  http://localhost:$Port/" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop." -ForegroundColor Gray
Write-Host ""

$mime = @{
    ".html"  = "text/html; charset=utf-8"
    ".htm"   = "text/html; charset=utf-8"
    ".css"   = "text/css; charset=utf-8"
    ".js"    = "application/javascript; charset=utf-8"
    ".json"  = "application/json; charset=utf-8"
    ".svg"   = "image/svg+xml"
    ".png"   = "image/png"
    ".jpg"   = "image/jpeg"
    ".jpeg"  = "image/jpeg"
    ".gif"   = "image/gif"
    ".ico"   = "image/x-icon"
    ".webp"  = "image/webp"
    ".woff"  = "font/woff"
    ".woff2" = "font/woff2"
    ".txt"   = "text/plain; charset=utf-8"
    ".md"    = "text/markdown; charset=utf-8"
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $req = $context.Request
        $res = $context.Response

        $relPath = [System.Web.HttpUtility]::UrlDecode($req.Url.AbsolutePath).TrimStart('/')
        if ([string]::IsNullOrEmpty($relPath)) { $relPath = "index.html" }
        # block trivial path traversal
        $relPath = $relPath.Replace("..", "")
        $file = Join-Path $root $relPath

        if ((Test-Path -LiteralPath $file -PathType Container)) {
            $file = Join-Path $file "index.html"
        }

        if (Test-Path -LiteralPath $file -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($file).ToLower()
            $type = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }
            $res.ContentType = $type
            try {
                $bytes = [System.IO.File]::ReadAllBytes($file)
                $res.ContentLength64 = $bytes.Length
                # A HEAD request wants the headers and nothing else. Writing a body
                # to it throws, and this used to fall into the catch below and answer
                # 500 - to every link-preview bot that checks a URL with HEAD before
                # fetching it, which is how WhatsApp and Slack decide what to show.
                if ($req.HttpMethod -ne "HEAD") {
                    $res.OutputStream.Write($bytes, 0, $bytes.Length)
                }
                Write-Host ("  {0,-4} {1,-50}  {2}" -f "200", $req.Url.AbsolutePath, $type) -ForegroundColor DarkGreen
            } catch {
                $res.StatusCode = 500
                Write-Host ("  500  {0}  {1}" -f $req.Url.AbsolutePath, $_.Exception.Message) -ForegroundColor Red
            }
        } else {
            $res.StatusCode = 404
            $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $relPath")
            $res.ContentType = "text/plain; charset=utf-8"
            $res.ContentLength64 = $msg.Length
            $res.OutputStream.Write($msg, 0, $msg.Length)
            Write-Host ("  404  {0}" -f $req.Url.AbsolutePath) -ForegroundColor DarkYellow
        }

        try { $res.Close() } catch {}
    }
} finally {
    if ($listener) {
        try { $listener.Stop() } catch {}
        try { $listener.Close() } catch {}
    }
    Write-Host "Server stopped." -ForegroundColor Gray
}
