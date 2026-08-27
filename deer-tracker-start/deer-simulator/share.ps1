<#
.SYNOPSIS
    Spin up a public, sharable HTTPS URL for the Phoenix Park Deer Tracker.

.DESCRIPTION
    Starts the local serve.ps1 in the background, then runs cloudflared to
    create a Cloudflare Quick Tunnel. You will see a URL like:

        https://random-three-words.trycloudflare.com

    Anyone can hit that link from anywhere - phone, laptop, friend abroad.
    The link lives only as long as this script is running. When you press
    Ctrl+C, the tunnel and the local server both shut down.

    No Cloudflare account or signup needed. You only need cloudflared
    installed once:

        winget install --id Cloudflare.cloudflared

    (or download from https://github.com/cloudflare/cloudflared/releases)

.PARAMETER Port
    Local port. Default 8080.

.EXAMPLE
    .\share.ps1
    .\share.ps1 -Port 9000
#>
param([int]$Port = 8080)

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "cloudflared is not installed." -ForegroundColor Red
    Write-Host ""
    Write-Host "Install it once with:" -ForegroundColor Yellow
    Write-Host "    winget install --id Cloudflare.cloudflared" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Then re-run .\share.ps1." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Alternative (no install): drag this folder onto" -ForegroundColor Gray
    Write-Host "    https://app.netlify.com/drop" -ForegroundColor Cyan
    Write-Host "to get a free https://*.netlify.app URL." -ForegroundColor Gray
    exit 1
}

$root = $PSScriptRoot
Write-Host ""
Write-Host "Starting local server on port $Port..." -ForegroundColor Green
$serveJob = Start-Job -ScriptBlock {
    param($p, $r)
    & "$r\serve.ps1" -Port $p
} -ArgumentList $Port, $root

# Give the listener a moment to bind
Start-Sleep -Seconds 1

try {
    $null = Invoke-WebRequest "http://localhost:$Port/" -UseBasicParsing -TimeoutSec 3
    Write-Host "Local server is up." -ForegroundColor Green
} catch {
    Write-Host "Local server didn't respond on port $Port - tunnel may 502." -ForegroundColor Yellow
    Write-Host "  Check the background job with:  Receive-Job $($serveJob.Id)" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "Starting Cloudflare quick tunnel..." -ForegroundColor Green
Write-Host "Look for the trycloudflare.com URL below - that's your shareable link." -ForegroundColor Cyan
Write-Host "Ctrl+C to stop both the tunnel and the server." -ForegroundColor Gray
Write-Host ""

try {
    # --http-host-header is NOT optional here.
    # serve.ps1 binds only the "localhost" HttpListener prefix, so it rejects any
    # request whose Host header is something else. cloudflared forwards the
    # trycloudflare hostname as Host by default, which makes every public request
    # return 400 while localhost keeps working perfectly - the worst kind of bug.
    & cloudflared tunnel --url "http://localhost:$Port" --http-host-header localhost
} finally {
    Write-Host ""
    Write-Host "Stopping local server..." -ForegroundColor Gray
    Stop-Job $serveJob -ErrorAction SilentlyContinue
    Remove-Job $serveJob -Force -ErrorAction SilentlyContinue
}
