$ErrorActionPreference = "Continue"
$RootDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$ApkPath = Join-Path $RootDir "VidaModernaNews.apk"
$AdbPath = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"

Write-Host "==============================================================" -ForegroundColor Green
Write-Host "  INSTALADOR AUTOMATICO - VIDA MODERNA NEWS (AQUARIUS STV-PLUS)" -ForegroundColor Green
Write-Host "==============================================================" -ForegroundColor Green

if (-not (Test-Path $ApkPath)) {
  Write-Host "Compilando VidaModernaNews.apk..." -ForegroundColor Cyan
  powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RootDir "gerar_apk.ps1")
}

# 1. Verifica se ha um Pendrive USB conectado no PC para copiar o APK automaticamente
$usbDrives = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=2" -ErrorAction SilentlyContinue
if ($usbDrives) {
  foreach ($drive in $usbDrives) {
    $dest = Join-Path $drive.DeviceID "VidaModernaNews.apk"
    Copy-Item $ApkPath $dest -Force
    Write-Host "[OK] APK copiado automaticamente para o Pendrive ($($drive.DeviceID)\VidaModernaNews.apk)!" -ForegroundColor Yellow
  }
}

# 2. Verifica se a Aquarius STV-Plus esta conectada via cabo USB (ADB)
if (Test-Path $AdbPath) {
  $devicesOut = & $AdbPath devices | Select-String -Pattern "\tdevice$"
  if ($devicesOut) {
    Write-Host "Aparelho Android detectado via USB/ADB! Instalando VidaModernaNews.apk..." -ForegroundColor Cyan
    & $AdbPath install -r "$ApkPath"
    Write-Host "Iniciando o app Vida Moderna News na tela da Aquarius STV-Plus..." -ForegroundColor Green
    & $AdbPath shell am start -n "br.com.falasindico.player/.MainActivity"
    Write-Host "[SUCESSO] Aplicativo instalado e aberto no aparelho!" -ForegroundColor Green
    exit 0
  }

  Write-Host ""
  Write-Host "Nenhum cabo USB ADB detectado no momento." -ForegroundColor Gray
  Write-Host "Opcoes para instalar agora no seu Aquarius STV-Plus:" -ForegroundColor White
  Write-Host "  [1] Instalar via Rede Wi-Fi (ADB por IP do Aquarius)" -ForegroundColor Cyan
  Write-Host "  [2] Copiar o APK para um Pendrive / Abrir pasta do APK" -ForegroundColor Yellow
  Write-Host ""
  $opcao = Read-Host "Digite 1 ou 2 (ou pressione Enter para abrir a pasta com o APK)"

  if ($opcao -eq "1") {
    $ipAquarius = Read-Host "Digite o IP do Aquarius STV-Plus no Wi-Fi (ex: 192.168.1.50)"
    if (-not [string]::IsNullOrWhiteSpace($ipAquarius)) {
      & $AdbPath connect "$($ipAquarius.Trim()):5555"
      & $AdbPath install -r "$ApkPath"
      & $AdbPath shell am start -n "br.com.falasindico.player/.MainActivity"
    }
  } else {
    explorer.exe "/select,`"$ApkPath`""
  }
} else {
  explorer.exe "/select,`"$ApkPath`""
}
