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
param(
    [int]$Port = 8080,
    # -Lan makes the server answer other devices on the same wifi, so you can
    # open the site on a phone. Without it the server only answers this
    # computer, which is why "it works on my laptop" is never proof of anything.
    [switch]$Lan
)

Add-Type -AssemblyName System.Web

$root = $PSScriptRoot
$listener = [System.Net.HttpListener]::new()

if ($Lan) {
    # "+" means every network card on this machine. Windows requires this to be
    # run from an Administrator PowerShell (or a one-off url reservation),
    # because letting any program answer the network is a privilege.
    $prefix = "http://+:$Port/"
} else {
    $prefix = "http://localhost:$Port/"
}
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    Write-Host "Could not bind to $prefix" -ForegroundColor Red
    if ($Lan) {
        Write-Host ""
        Write-Host "-Lan needs an Administrator PowerShell." -ForegroundColor Yellow
        Write-Host "Right-click PowerShell -> Run as administrator, then try again." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Or reserve the port once, as administrator, and then you never" -ForegroundColor Gray
        Write-Host "need admin for it again:" -ForegroundColor Gray
        Write-Host "    netsh http add urlacl url=http://+:$Port/ user=$env:USERNAME" -ForegroundColor Cyan
    } else {
        Write-Host "Is something else using port $Port? Try: .\serve.ps1 -Port 8081" -ForegroundColor Yellow
    }
    exit 1
}

# The address other devices have to type. There is usually more than one network
# card - the wifi one is what a phone can reach.
$lanIps = @()
try {
    $lanIps = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
        Where-Object { $_.IPAddress -notlike "127.*" -and $_.PrefixOrigin -ne "WellKnown" } |
        Select-Object -ExpandProperty IPAddress
} catch { }

Write-Host ""
Write-Host "Phoenix Park Deer Tracker - local server" -ForegroundColor Green
Write-Host "Serving:    $root" -ForegroundColor Gray
Write-Host "On this pc: http://localhost:$Port/" -ForegroundColor Cyan

if ($Lan) {
    Write-Host ""
    Write-Host "On a phone (same wifi), type one of these:" -ForegroundColor Green
    foreach ($ip in $lanIps) {
        Write-Host "            http://${ip}:$Port/" -ForegroundColor Cyan
    }
    Write-Host ""
    Write-Host "If the phone cannot reach it, it is almost always one of:" -ForegroundColor Gray
    Write-Host "  - the phone is on mobile data, not the wifi" -ForegroundColor Gray
    Write-Host "  - Windows Firewall asked and you said no (allow Private networks)" -ForegroundColor Gray
    Write-Host "  - the wifi has client isolation on (common in cafes and schools)" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "Only this computer can reach it. For a phone: .\serve.ps1 -Lan" -ForegroundColor Gray
}
Write-Host ""
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
