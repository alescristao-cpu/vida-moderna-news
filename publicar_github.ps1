# ==============================================================================
# PUBLICADOR AUTOMÁTICO NO GITHUB — VIDA MODERNA NEWS (Usuário: alescristao-cpu)
# ==============================================================================
$ErrorActionPreference = "Stop"
$ProjectDir = $PSScriptRoot
Set-Location $ProjectDir

$GitHubUser = "alescristao-cpu"
$RepoName   = "vida-moderna-news"
$RemoteUrl  = "https://github.com/$GitHubUser/$RepoName.git"

Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host " PUBLICANDO VIDA MODERNA NEWS NO GITHUB ($GitHubUser)" -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan

if (-not (Test-Path "$ProjectDir\.git")) {
    git init
}

git config user.name "$GitHubUser"
git config user.email "$GitHubUser@users.noreply.github.com"

# Cria .gitignore para não enviar arquivos temporários de compilação
@"
android-app/build-apk/
node_modules/
"@ | Set-Content -Path "$ProjectDir\.gitignore" -Encoding UTF8

git branch -M main
git add .
git commit -m "Publicacao Vida Moderna News (Player 1280x720 + Painel Admin + APK Aquarius STV-Plus)" 2>$null

$existingRemote = git remote
if ($existingRemote -contains "origin") {
    git remote set-url origin $RemoteUrl
} else {
    git remote add origin $RemoteUrl
}

Write-Host "Enviando arquivos para $RemoteUrl ..." -ForegroundColor Yellow
git push -u origin main --force

Write-Host ""
Write-Host "==============================================================" -ForegroundColor Green
Write-Host " ENVIADO COM SUCESSO PARA O GITHUB!" -ForegroundColor Green
Write-Host " Painel Admin: https://$GitHubUser.github.io/$RepoName/admin.html" -ForegroundColor Green
Write-Host " Player TV:    https://$GitHubUser.github.io/$RepoName/" -ForegroundColor Green
Write-Host " Download APK: https://$GitHubUser.github.io/$RepoName/VidaModernaNews.apk" -ForegroundColor Green
Write-Host "==============================================================" -ForegroundColor Green
