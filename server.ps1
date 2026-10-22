param(
  [int]$Port = 8080
)

$ErrorActionPreference = "Stop"
$RootDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$PublicDir = Join-Path $RootDir "public"
$DataFile = Join-Path $RootDir "data\state.json"
$script:LastRssUpdate = [DateTime]::MinValue

# Catálogo oficial de temas de interesse com feeds RSS reais (G1)
$ThemeCatalog = @{
  "tecnologia"    = @{ url = "https://g1.globo.com/rss/g1/tecnologia/";       fonte = "G1 • TECNOLOGIA"; cor = "#0d74b8" }
  "ciencia_saude" = @{ url = "https://g1.globo.com/rss/g1/ciencia-e-saude/";  fonte = "G1 • SAÚDE & CIÊNCIA"; cor = "#2a5e35" }
  "bemestar"      = @{ url = "https://g1.globo.com/rss/g1/bemestar/";         fonte = "G1 • BEM-ESTAR"; cor = "#16a34a" }
  "turismo"       = @{ url = "https://g1.globo.com/rss/g1/turismo-e-viagem/"; fonte = "G1 • TURISMO"; cor = "#0284c7" }
  "natureza"      = @{ url = "https://g1.globo.com/rss/g1/natureza/";         fonte = "G1 • NATUREZA"; cor = "#15803d" }
  "economia"      = @{ url = "https://g1.globo.com/rss/g1/economia/";         fonte = "G1 • ECONOMIA"; cor = "#d97706" }
  "educacao"      = @{ url = "https://g1.globo.com/rss/g1/educacao/";         fonte = "G1 • EDUCAÇÃO"; cor = "#4f46e5" }
  "cultura"       = @{ url = "https://g1.globo.com/rss/g1/pop-arte/";         fonte = "G1 • CULTURA & ARTE"; cor = "#9333ea" }
  "carros"        = @{ url = "https://g1.globo.com/rss/g1/carros/";           fonte = "G1 • AUTOMÓVEIS"; cor = "#0f766e" }
  "geral"         = @{ url = "https://g1.globo.com/rss/g1/";                  fonte = "G1 • BRASIL"; cor = "#5bb75b" }
}

# Palavras bloqueadas pelo Filtro de Classificação Familiar (Livre para todos os públicos / Elevador)
$StrictFamilyBlockedTerms = @(
  "morte", "morto", "morta", "morre", "morrem", "morreu", "assassin", "homicid", "homicíd",
  "feminicid", "feminicíd", "crime", "criminos", "tiroteio", "tiro", "balead", "facad",
  "esfaque", "arma", "fuzil", "pistola", "assalto", "assaltante", "roubo", "furto", "sequestr",
  "refem", "refém", "policia", "polícia", "policial", "preso", "presa", "prisao", "prisão",
  "cadeia", "presidio", "presídio", "detento", "trafico", "tráfico", "traficante", "droga",
  "cocaina", "cocaína", "maconha", "crack", "entorpecente", "massacre", "chacina", "terroris",
  "bomba", "explosao", "explosão", "cadaver", "cadáver", "corpo encontrado", "necropsia",
  "delegacia", "suspeito", "foragido", "faccao", "facção", "milicia", "milícia", "latrocinio",
  "latrocínio", "estupr", "abuso", "assedio", "assédio", "pedofil", "porn", "sexo", "sexual",
  "nudez", "erotic", "erótic", "prostitui", "suicid", "suicíd", "se matou", "tragedia",
  "tragédia", "acidente grave", "vitima fatal", "vítima fatal", "afogamento", "desabamento",
  "atropelad", "tortura", "espancad", "agressao", "agressão", "agredid", "sangue", "violencia",
  "violência", "guerra", "bombardeio", "execucao", "execução", "executad", "linchamento"
)

$ModerateFamilyBlockedTerms = @(
  "assassin", "homicid", "homicíd", "feminicid", "feminicíd", "chacina", "massacre",
  "estupr", "pedofil", "porn", "sexo", "sexual", "nudez", "erotic", "erótic", "prostitui",
  "suicid", "suicíd", "se matou", "tortura", "decapit", "esquartej"
)

function Test-FamilySafeNews {
  param(
    [string]$Title,
    [string]$Description,
    [string]$FilterLevel = "rigoroso",
    [string]$CustomBlockedCsv = ""
  )

  if ($FilterLevel -eq "desativado") { return $true }

  $textToCheck = ("$Title $Description").ToLower()

  $terms = if ($FilterLevel -eq "moderado") { $ModerateFamilyBlockedTerms } else { $StrictFamilyBlockedTerms }
  foreach ($term in $terms) {
    if ($textToCheck.Contains($term.ToLower())) {
      return $false
    }
  }

  if (-not [string]::IsNullOrWhiteSpace($CustomBlockedCsv)) {
    $customList = $CustomBlockedCsv -split '[,;\n]'
    foreach ($c in $customList) {
      $clean = $c.Trim().ToLower()
      if ($clean.Length -ge 2 -and $textToCheck.Contains($clean)) {
        return $false
      }
    }
  }

  return $true
}

function Fetch-RssXmlUtf8 {
  param([string]$Url)
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $req = [System.Net.HttpWebRequest]::Create($Url)
  $req.AutomaticDecompression = [System.Net.DecompressionMethods]::GZip -bor [System.Net.DecompressionMethods]::Deflate
  $req.UserAgent = "Mozilla/5.0 VidaModernaNews/2.0"
  $req.Timeout = 7000
  $resp = $req.GetResponse()
  $reader = New-Object System.IO.StreamReader($resp.GetResponseStream(), [System.Text.Encoding]::UTF8)
  $xmlString = $reader.ReadToEnd()
  $reader.Close()
  $resp.Close()
  return [xml]$xmlString
}

function Update-G1RssNews {
  try {
    $stateRaw = Get-Content $DataFile -Raw -Encoding UTF8
    $state = $stateRaw | ConvertFrom-Json
    if (-not $state.config.rssAtivo) { return $state }

    $temasSelecionados = @()
    if ($state.config.rssTemas -and $state.config.rssTemas.Count -gt 0) {
      $temasSelecionados = @($state.config.rssTemas)
    } else {
      $temasSelecionados = @("tecnologia", "ciencia_saude", "turismo", "cultura")
    }

    $filtroNivel = if ($state.config.filtroFamiliarNivel) { [string]$state.config.filtroFamiliarNivel } else { "rigoroso" }
    $palavrasBloqueadas = if ($state.config.palavrasBloqueadas) { [string]$state.config.palavrasBloqueadas } else { "" }
    $temaPersonalizado = if ($state.config.temaPersonalizado) { [string]$state.config.temaPersonalizado } else { "" }
    $apenasComFoto = if ($null -ne $state.config.apenasComFoto) { [bool]$state.config.apenasComFoto } else { $true }
    $maxNoticias = if ($state.config.limiteNoticias) { [int]$state.config.limiteNoticias } else { 10 }

    $feedsToFetch = @()
    foreach ($tKey in $temasSelecionados) {
      if ($ThemeCatalog.ContainsKey($tKey)) {
        $feedsToFetch += $ThemeCatalog[$tKey]
      }
    }

    # Se o usuário digitou um tema personalizado (ex: "Arquitetura", "Gastronomia", "Natal RN"), busca via Google News RSS
    if (-not [string]::IsNullOrWhiteSpace($temaPersonalizado)) {
      $encodedQuery = [System.Uri]::EscapeDataString($temaPersonalizado.Trim())
      $feedsToFetch += @{
        url   = "https://news.google.com/rss/search?q=$encodedQuery&hl=pt-BR&gl=BR&ceid=BR:pt-419"
        fonte = "NEWS • " + $temaPersonalizado.Trim().ToUpper()
        cor   = "#2a5e35"
      }
    }

    if ($feedsToFetch.Count -eq 0) {
      $feedsToFetch += $ThemeCatalog["tecnologia"]
    }

    $collectedByFeed = @()
    $totalAnalisadas = 0
    $totalBloqueadas = 0

    foreach ($feedInfo in $feedsToFetch) {
      try {
        $xmlDoc = Fetch-RssXmlUtf8 -Url $feedInfo.url
        $items = $xmlDoc.rss.channel.item
        if ($null -eq $items) { continue }

        $feedItems = @()
        foreach ($item in ($items | Select-Object -First 25)) {
          $totalAnalisadas++
          $title = ([string]$item.title).Trim()
          $desc = ([string]$item.description)
          if ([string]::IsNullOrWhiteSpace($title)) { continue }

          # Aplica o Filtro de Classificação Familiar
          $isSafe = Test-FamilySafeNews -Title $title -Description $desc -FilterLevel $filtroNivel -CustomBlockedCsv $palavrasBloqueadas
          if (-not $isSafe) {
            $totalBloqueadas++
            continue
          }

          # Extrai imagem de alta resolução (media:content / enclosure / img src)
          $imgUrl = ""
          if ($item.content -and $item.content.url) {
            $imgUrl = [string]$item.content.url
          } elseif ($item.enclosure -and $item.enclosure.url) {
            $imgUrl = [string]$item.enclosure.url
          } elseif ($desc -match '<img[^>]+src="([^">]+)"') {
            $imgUrl = $Matches[1]
          }

          if ($apenasComFoto -and [string]::IsNullOrWhiteSpace($imgUrl) -and (-not $feedInfo.url.Contains("news.google.com"))) {
            continue
          }

          if ([string]::IsNullOrWhiteSpace($imgUrl)) {
            $imgUrl = "assets/news-bg-default.svg"
          }

          $feedItems += [PSCustomObject]@{
            id          = "not-" + [Guid]::NewGuid().ToString("N").Substring(0, 8)
            fonte       = $feedInfo.fonte
            corBarra    = $feedInfo.cor
            titulo      = $title
            imagemUrl   = $imgUrl
            publicadoEm = [string]$item.pubDate
            ativo       = $true
          }

          if ($feedItems.Count -ge 6) { break }
        }

        if ($feedItems.Count -gt 0) {
          $collectedByFeed += ,$feedItems
        }
      } catch {
        # Continua para o próximo tema caso um feed oscile
      }
    }

    # Intercala notícias entre os diferentes temas escolhidos para variedade no elevador
    $finalNoticias = @()
    $seenTitles = @{}
    for ($round = 0; $round -lt 6; $round++) {
      foreach ($feedList in $collectedByFeed) {
        if ($round -lt $feedList.Count) {
          $candidate = $feedList[$round]
          if (-not $seenTitles.ContainsKey($candidate.titulo)) {
            $seenTitles[$candidate.titulo] = $true
            $finalNoticias += $candidate
            if ($finalNoticias.Count -ge $maxNoticias) { break }
          }
        }
      }
      if ($finalNoticias.Count -ge $maxNoticias) { break }
    }

    # Atualiza estatísticas do Filtro Familiar no config
    $state.config | Add-Member -NotePropertyName "ultimoFiltroStats" -NotePropertyValue ([PSCustomObject]@{
      analisadas   = $totalAnalisadas
      bloqueadas   = $totalBloqueadas
      aprovadas    = $finalNoticias.Count
      atualizadoEm = (Get-Date).ToString("dd/MM/yyyy HH:mm:ss")
    }) -Force

    if ($finalNoticias.Count -gt 0) {
      $state.noticias = $finalNoticias
      $state.version = [int]$state.version + 1
      $state.updatedAt = (Get-Date).ToString("o")
      $jsonOut = $state | ConvertTo-Json -Depth 10
      [System.IO.File]::WriteAllText($DataFile, $jsonOut, [System.Text.Encoding]::UTF8)
      $script:LastRssUpdate = Get-Date
    }
    return $state
  } catch {
    return (Get-Content $DataFile -Raw -Encoding UTF8 | ConvertFrom-Json)
  }
}

$localIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } | Select-Object -First 1).IPAddress
if (-not $localIp) { $localIp = "localhost" }

$listener = New-Object System.Net.HttpListener
try {
  $listener.Prefixes.Add("http://+:$Port/")
  $listener.Start()
} catch {
  $listener = New-Object System.Net.HttpListener
  $listener.Prefixes.Add("http://localhost:$Port/")
  $listener.Prefixes.Add("http://127.0.0.1:$Port/")
  $listener.Start()
}

Write-Host "==============================================================" -ForegroundColor Green
Write-Host "  VIDA MODERNA NEWS - AUTO-RSS POR TEMAS + FILTRO FAMILIAR    " -ForegroundColor Green
Write-Host "==============================================================" -ForegroundColor Green
Write-Host "-> Painel no PC:              http://localhost:$Port/admin.html" -ForegroundColor Yellow
Write-Host "-> IP p/ Aquarius STV-Plus:   http://${localIp}:$Port" -ForegroundColor Cyan
Write-Host "-> Download APK na Rede:      http://${localIp}:$Port/VidaModernaNews.apk" -ForegroundColor Magenta
Write-Host "==============================================================" -ForegroundColor Green

$null = Update-G1RssNews

$mimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".svg"  = "image/svg+xml"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".mp4"  = "video/mp4"
  ".webm" = "video/webm"
  ".apk"  = "application/vnd.android.package-archive"
}

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $req = $context.Request
    $res = $context.Response

    $res.Headers.Add("Access-Control-Allow-Origin", "*")
    $res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    $res.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Accept")

    if ($req.HttpMethod -eq "OPTIONS") {
      $res.StatusCode = 204
      $res.Close()
      continue
    }

    $path = $req.Url.LocalPath

    if ($path -eq "/api/state" -and $req.HttpMethod -eq "GET") {
      if (((Get-Date) - $script:LastRssUpdate).TotalMinutes -ge 5) {
        $null = Update-G1RssNews
      }
      $jsonBytes = [System.IO.File]::ReadAllBytes($DataFile)
      $res.ContentType = "application/json; charset=utf-8"
      $res.ContentLength64 = $jsonBytes.Length
      $res.OutputStream.Write($jsonBytes, 0, $jsonBytes.Length)
      $res.Close()
      continue
    }

    if ($path -eq "/api/state" -and $req.HttpMethod -eq "POST") {
      $reader = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
      $body = $reader.ReadToEnd()
      $reader.Close()
      [System.IO.File]::WriteAllText($DataFile, $body, [System.Text.Encoding]::UTF8)

      # Se a requisicao pedir atualizacao imediata do RSS pelos novos temas/filtros:
      if ($req.Url.Query -match "refreshRss=1") {
        $null = Update-G1RssNews
      }

      $jsonBytes = [System.IO.File]::ReadAllBytes($DataFile)
      $res.ContentType = "application/json; charset=utf-8"
      $res.ContentLength64 = $jsonBytes.Length
      $res.OutputStream.Write($jsonBytes, 0, $jsonBytes.Length)
      $res.Close()
      continue
    }

    if ($path -eq "/api/sync-rss") {
      $null = Update-G1RssNews
      $jsonBytes = [System.IO.File]::ReadAllBytes($DataFile)
      $res.ContentType = "application/json; charset=utf-8"
      $res.ContentLength64 = $jsonBytes.Length
      $res.OutputStream.Write($jsonBytes, 0, $jsonBytes.Length)
      $res.Close()
      continue
    }

    if ($path -eq "/") { $path = "/index.html" }
    $relPath = $path.TrimStart('/').Replace('/', '\')
    $filePath = Join-Path $PublicDir $relPath

    if (Test-Path $filePath -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
      $res.ContentType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
      $fileBytes = [System.IO.File]::ReadAllBytes($filePath)
      $res.ContentLength64 = $fileBytes.Length
      $res.OutputStream.Write($fileBytes, 0, $fileBytes.Length)
    } else {
      $res.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes("404 - Arquivo nao encontrado")
      $res.OutputStream.Write($msg, 0, $msg.Length)
    }
    $res.Close()
  }
} finally {
  $listener.Stop()
}
