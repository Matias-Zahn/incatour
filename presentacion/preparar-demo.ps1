# Prepara y levanta la demo en una PC nueva. Uso, desde la raiz del repo, con Docker Desktop abierto:
#   powershell -ExecutionPolicy Bypass -File presentacion\preparar-demo.ps1
# -SinReconstruir: no rearma incatour_demo (usar si ya se armo hoy y solo hay que volver a levantar).
# Nunca toca incatour_db: la demo vive en su propia base (incatour_demo).
param([switch]$SinReconstruir)

$ErrorActionPreference = "Stop"
$raiz = Split-Path $PSScriptRoot
$back = Join-Path $raiz "backend"
$front = Join-Path $raiz "frontend"
$urlDemo = "postgresql://postgres:postgrespassword@localhost:5432/incatour_demo"

function Paso($texto) { Write-Host ""; Write-Host "=== $texto ===" -ForegroundColor Cyan }
function Fallar($texto) { Write-Host ""; Write-Host "ERROR: $texto" -ForegroundColor Red; exit 1 }
function Correr($dir, $comando) {
    Push-Location $dir
    cmd /c $comando
    $codigo = $LASTEXITCODE
    Pop-Location
    if ($codigo -ne 0) { Fallar "fallo '$comando' en $dir" }
}

Paso "1. Programas necesarios"
foreach ($p in "git", "node", "npm", "docker") {
    if (-not (Get-Command $p -ErrorAction SilentlyContinue)) { Fallar "falta $p (ver la guia: presentacion\preparar-otra-pc.md)" }
}
Write-Host "node $(node -v)"
cmd /c "docker info >nul 2>nul"
if ($LASTEXITCODE -ne 0) { Fallar "Docker no esta corriendo: abri Docker Desktop, espera a que diga 'Engine running' y volve a correr el script" }

Paso "2. Postgres y Mailpit (docker compose)"
Push-Location $raiz
cmd /c "docker compose up -d 2>nul"
$codigo = $LASTEXITCODE
Pop-Location
# Contenedores con el mismo nombre creados antes, fuera de compose: se arrancan los que ya existen
if ($codigo -ne 0) {
    cmd /c "docker start incatour_postgres incatour_mailpit"
    if ($LASTEXITCODE -ne 0) { Fallar "no se pudieron levantar Postgres y Mailpit (docker compose up -d)" }
}
Write-Host "Esperando a Postgres..."
$listo = $false
for ($i = 0; $i -lt 60; $i++) {
    cmd /c "docker exec incatour_postgres pg_isready -U postgres >nul 2>nul"
    if ($LASTEXITCODE -eq 0) { $listo = $true; break }
    Start-Sleep 1
}
if (-not $listo) { Fallar "Postgres no respondio en 60 segundos" }

Paso "3. Archivos .env"
$envBack = Join-Path $back ".env"
if (-not (Test-Path $envBack)) { Copy-Item (Join-Path $back ".env.example") $envBack; Write-Host "creado backend\.env" } else { Write-Host "backend\.env ya existe" }
$envFront = Join-Path $front ".env.local"
if (-not (Test-Path $envFront)) { Set-Content $envFront "VITE_USE_MOCKS=false" -Encoding ascii; Write-Host "creado frontend\.env.local" } else { Write-Host "frontend\.env.local ya existe (tiene que decir VITE_USE_MOCKS=false)" }

Paso "4. Dependencias (la primera vez tarda unos minutos)"
Correr $back "npm install"
Correr $back "npx prisma generate"
Correr $front "npm install"

if (-not $SinReconstruir) {
    Paso "5. Base de la demo (incatour_demo, tarda unos minutos)"
    Correr $back "npm run demo"
    Write-Host "Anota los numeros de salida que imprimio arriba." -ForegroundColor Yellow
} else {
    Paso "5. Base de la demo: se usa la que ya estaba"
}

Paso "6. Back (3000) y front (5173) en dos ventanas"
foreach ($puerto in 3000, 5173) {
    if (Get-NetTCPConnection -LocalPort $puerto -State Listen -ErrorAction SilentlyContinue) {
        Fallar "el puerto $puerto ya esta en uso: cerra las ventanas del back o del front que hayan quedado abiertas"
    }
}
Start-Process powershell -WorkingDirectory $back -ArgumentList "-NoExit", "-Command",
    "`$Host.UI.RawUI.WindowTitle='IncaTour back'; `$env:DB_NAME='incatour_demo'; `$env:DATABASE_URL='$urlDemo'; `$env:SMTP_HOST='localhost'; `$env:SMTP_PORT='1025'; npm run dev"
Start-Process powershell -WorkingDirectory $front -ArgumentList "-NoExit", "-Command",
    "`$Host.UI.RawUI.WindowTitle='IncaTour front'; npm run dev"

Write-Host "Esperando a que respondan..."
foreach ($url in "http://localhost:3000/api/paquetes", "http://localhost:5173") {
    $ok = $false
    for ($i = 0; $i -lt 90; $i++) {
        try { Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 2 | Out-Null; $ok = $true; break }
        catch { if ($_.Exception.Response) { $ok = $true; break }; Start-Sleep 1 }
    }
    if (-not $ok) { Fallar "no respondio $url (mira la ventana correspondiente)" }
}

Paso "Listo"
Write-Host "App:     http://localhost:5173"
Write-Host "Mailpit: http://localhost:8025"
Write-Host "Usuarios y datos para la demo: presentacion\datos-demo.md"
Write-Host "Para apagar: cerrar las ventanas 'IncaTour back' y 'IncaTour front'."
Start-Process "http://localhost:5173"
