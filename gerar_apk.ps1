$ErrorActionPreference = "Continue"

$RootDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$SdkDir = "$env:LOCALAPPDATA\Android\Sdk"
$BuildTools = "$SdkDir\build-tools\36.0.0"
$AndroidJar = "$SdkDir\platforms\android-37.0\android.jar"
$JavaBin = "C:\Program Files\Android\Android Studio\jbr\bin"

$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:PATH = "$JavaBin;$BuildTools;$env:PATH"

$BuildWork = Join-Path $RootDir "android-app\build-apk"
if (Test-Path $BuildWork) { Remove-Item $BuildWork -Recurse -Force }
New-Item -ItemType Directory -Path "$BuildWork\res\mipmap-mdpi" -Force | Out-Null
New-Item -ItemType Directory -Path "$BuildWork\assets\public" -Force | Out-Null
New-Item -ItemType Directory -Path "$BuildWork\gen" -Force | Out-Null
New-Item -ItemType Directory -Path "$BuildWork\classes" -Force | Out-Null
New-Item -ItemType Directory -Path "$BuildWork\dex" -Force | Out-Null

# 1. Copia o ícone Modern Life Residence para res/mipmap-mdpi/ic_launcher.png
Copy-Item (Join-Path $RootDir "public\assets\logo-modern-life.png") "$BuildWork\res\mipmap-mdpi\ic_launcher.png" -Force

# 2. Copia todos os arquivos do Player/Admin para dentro de assets/public/ do APK (excluindo o próprio .apk se existir)
Get-ChildItem (Join-Path $RootDir "public") -Exclude "*.apk" | Copy-Item -Destination "$BuildWork\assets\public" -Recurse -Force

# 3. Compila recursos com aapt2
Write-Host "[1/5] Compilando recursos Android (aapt2)..." -ForegroundColor Cyan
& "$BuildTools\aapt2.exe" compile --dir "$BuildWork\res" -o "$BuildWork\resources.zip"

$ManifestPath = Join-Path $RootDir "android-app\app\src\main\AndroidManifest.xml"
& "$BuildTools\aapt2.exe" link `
  -I "$AndroidJar" `
  --manifest "$ManifestPath" `
  -A "$BuildWork\assets" `
  --java "$BuildWork\gen" `
  -o "$BuildWork\unaligned.apk" `
  "$BuildWork\resources.zip"

# 4. Compila código Java (MainActivity.java, BootReceiver.java e R.java) com target Java 8 para compatibilidade com Aquarius STV-Plus
Write-Host "[2/5] Compilando classes Java para Aquarius STV-Plus..." -ForegroundColor Cyan
$JavaSrcDir = Join-Path $RootDir "android-app\app\src\main\java\br\com\falasindico\player"
$RJava = Join-Path $BuildWork "gen\br\com\falasindico\player\R.java"

& "$JavaBin\javac.exe" -encoding UTF-8 -source 1.8 -target 1.8 `
  -bootclasspath "$AndroidJar" `
  -classpath "$AndroidJar" `
  -d "$BuildWork\classes" `
  "$JavaSrcDir\MainActivity.java" `
  "$JavaSrcDir\BootReceiver.java" `
  "$RJava"

# 5. Converte bytecode Java para DEX (classes.dex) com d8 (min-api 21 para Android 5.0 / 7.1 Aquarius STV-Plus)
Write-Host "[3/5] Gerando classes.dex (d8 --min-api 21)..." -ForegroundColor Cyan
$ClassFiles = Get-ChildItem "$BuildWork\classes" -Recurse -Filter "*.class" | Select-Object -ExpandProperty FullName
& "$BuildTools\d8.bat" --min-api 21 --lib "$AndroidJar" --output "$BuildWork\dex" $ClassFiles

# Insere classes.dex dentro do unaligned.apk usando jar.exe
& "$JavaBin\jar.exe" uf "$BuildWork\unaligned.apk" -C "$BuildWork\dex" classes.dex

# 6. Alinha o APK com zipalign
Write-Host "[4/5] Alinhando pacote APK (zipalign)..." -ForegroundColor Cyan
& "$BuildTools\zipalign.exe" -f -p 4 "$BuildWork\unaligned.apk" "$BuildWork\aligned.apk"

# 7. Gera certificado de assinatura (keystore) e assina o APK (v1 + v2 signing para suportar Android 7.1 Aquarius STV-Plus e Android 14+)
Write-Host "[5/5] Assinando VidaModernaNews.apk (v1 + v2 scheme)..." -ForegroundColor Cyan
$KeystorePath = Join-Path $BuildWork "vidamoderna.jks"
& "$JavaBin\keytool.exe" -genkeypair -v `
  -keystore "$KeystorePath" `
  -alias vidamoderna `
  -keyalg RSA -keysize 2048 -validity 10000 `
  -storepass 123456 -keypass 123456 `
  -dname "CN=Vida Moderna News, OU=Modern Life Residence, O=VidaModerna, L=Natal, ST=RN, C=BR"

$FinalApkRoot = Join-Path $RootDir "VidaModernaNews.apk"
$FinalApkPublic = Join-Path $RootDir "public\VidaModernaNews.apk"

& "$BuildTools\apksigner.bat" sign `
  --ks "$KeystorePath" `
  --ks-pass pass:123456 `
  --key-pass pass:123456 `
  --v1-signing-enabled true `
  --v2-signing-enabled true `
  --out "$FinalApkRoot" `
  "$BuildWork\aligned.apk"

Copy-Item "$FinalApkRoot" "$FinalApkPublic" -Force

Write-Host "==============================================================" -ForegroundColor Green
Write-Host " APK GERADO COM SUCESSO PARA AQUARIUS STV-PLUS!               " -ForegroundColor Green
Write-Host " Arquivo: $FinalApkRoot" -ForegroundColor Yellow
Write-Host "==============================================================" -ForegroundColor Green
