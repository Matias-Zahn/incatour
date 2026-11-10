# Pruebas para mostrar en la presentacion. Uso, desde la raiz del repo, con Docker levantado:
#   powershell -ExecutionPolicy Bypass -File presentacion\mostrar-pruebas.ps1 <prueba>
# Ninguna toca incatour_db ni incatour_demo: cada una usa su propia base.
param(
    [Parameter(Mandatory)]
    [ValidateSet("preparar", "unitarias", "caja-blanca", "caja-negra", "caja-negra-vivo", "integral", "humo", "concurrencia")]
    [string]$Prueba
)
$ErrorActionPreference = "Stop"
$raiz = Split-Path $PSScriptRoot
$back = Join-Path $raiz "backend"
$front = Join-Path $raiz "frontend"
$dbCajaNegra = "incatour_cajanegra"
$urlDb = "postgresql://postgres:postgrespassword@localhost:5432/$dbCajaNegra"

function Titulo($texto) { Write-Host ""; Write-Host "=== $texto ===" -ForegroundColor Cyan; Write-Host "" }

function Esperar($url) {
    for ($i = 0; $i -lt 60; $i++) {
        try { Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 2 | Out-Null; return } catch { Start-Sleep 1 }
    }
    throw "No respondio $url"
}

# Levanta back (3998) y front (5191) sobre la base de caja negra, corre Playwright y los apaga
function CajaNegra($argsPlaywright) {
    $procs = @(
        Start-Process powershell -PassThru -WindowStyle Minimized -WorkingDirectory $back -ArgumentList "-NoProfile", "-Command",
            "`$env:PORT='3998'; `$env:DB_NAME='$dbCajaNegra'; `$env:DATABASE_URL='$urlDb'; `$env:SMTP_HOST=''; npx tsx src/app.ts"
        Start-Process powershell -PassThru -WindowStyle Minimized -WorkingDirectory $front -ArgumentList "-NoProfile", "-Command",
            "`$env:VITE_USE_MOCKS='false'; `$env:VITE_API_URL='http://localhost:3998/api'; npx vite --port 5191 --strictPort"
    )
    try {
        Write-Host "Levantando back y front..."
        Esperar "http://localhost:3998/api/catalogo"
        Esperar "http://localhost:5191"
        Push-Location $front
        # node directo: npx.cmd rompe el | del -g
        node node_modules/@playwright/test/cli.js test @argsPlaywright
    } finally {
        Pop-Location
        $procs | ForEach-Object { taskkill /T /F /PID $_.Id 2>&1 | Out-Null }
    }
}

Push-Location $back
try {
    switch ($Prueba) {
        "preparar" {
            Titulo "Armando la base $dbCajaNegra para la caja negra (una vez, antes de la clase)"
            $env:DEMO_DB = $dbCajaNegra; npm run demo
        }
        "unitarias" { Titulo "Tests unitarios del back (Vitest)"; npm test }
        "caja-blanca" { Titulo "Caja blanca: cobertura de la cancelacion y el reintegro"; npm run test:caja-blanca }
        "caja-negra" { Titulo "Caja negra: los 34 casos de la compra en Chrome"; CajaNegra @() }
        "caja-negra-vivo" {
            Titulo "Caja negra en vivo: pasaporte vencido, tarjeta sin fondos y compra valida"
            $env:LENTO = "400"
            CajaNegra @("--headed", "-g", "CN-06 |CN-24 |CN-27 ")
        }
        "integral" { Titulo "Integral: flujos alternativos y errores contra la API real"; npm run test:integral }
        "humo" { Titulo "Humo: ningun endpoint responde 5xx"; npm run test:humo }
        "concurrencia" { Titulo "Concurrencia: 20 compras a la vez sobre 10 lugares"; npm run test:concurrencia }
    }
} finally { Pop-Location }
