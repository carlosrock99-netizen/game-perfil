# Gera perfil-online-waifly.zip: pacote pronto para subir no Waifly
# (Pterodactyl). Leva o front ja compilado (client/dist), o servidor, o baralho
# e um package.json enxuto so com as dependencias de producao.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts\pacote-waifly.ps1

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz

if (-not (Test-Path 'client\dist\index.html')) {
  Write-Host 'Compilando o front (npm run build)...' -ForegroundColor Cyan
  npm run build
}

$saida = Join-Path $raiz 'perfil-online-waifly.zip'
$tmp = Join-Path $env:TEMP ('perfil-waifly-' + [guid]::NewGuid().ToString('n'))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

Copy-Item -Path 'server' -Destination (Join-Path $tmp 'server') -Recurse
Copy-Item -Path 'data' -Destination (Join-Path $tmp 'data') -Recurse
New-Item -ItemType Directory -Force -Path (Join-Path $tmp 'client') | Out-Null
Copy-Item -Path 'client\dist' -Destination (Join-Path $tmp 'client\dist') -Recurse

# package.json de producao: sem devDependencies (typescript, socket.io-client).
$pkg = @{
  name = 'perfil-online'
  version = '1.0.0'
  private = $true
  main = 'server/index.js'
  scripts = @{ start = 'node server/index.js' }
  dependencies = @{ express = '^4.21.2'; 'socket.io' = '^4.8.1' }
} | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText((Join-Path $tmp 'package.json'), $pkg)

if (Test-Path $saida) { Remove-Item $saida -Force }
Compress-Archive -Path (Join-Path $tmp '*') -DestinationPath $saida
Remove-Item $tmp -Recurse -Force

Write-Host ''
Write-Host ('Pacote pronto: ' + $saida) -ForegroundColor Green
Write-Host 'No Waifly: Files -> Upload -> Unarchive; Startup -> npm start; Start.' -ForegroundColor DarkGray
