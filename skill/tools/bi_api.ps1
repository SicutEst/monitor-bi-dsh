# bi_api.ps1 - zero-dependency Monitor BI client (Windows built-in PowerShell 5.1+)
# Same commands and bi_config.env as bi_api.js. Use when Node.js is NOT installed.
# NOTE: keep this file ASCII-only (PS 5.1 encoding safety with non-ASCII sources).
# Usage: powershell -ExecutionPolicy Bypass -File bi_api.ps1 <command> [args]
#   config <url> <company> <user> <pwd> | login | list
#   import <title> <xml> [categoryId] | save <id> <xml> [title]   (save = in-place, ID unchanged)
#   get <id> [outfile] | get-xml <id> [outfile] | verify [minutes] | backup <id...>
#   delete <id> | lang en|zh
param(
  [Parameter(Position = 0)] [string]$Command = '',
  [Parameter(Position = 1, ValueFromRemainingArguments = $true)] [string[]]$Rest = @()
)

$ErrorActionPreference = 'Stop'
$ToolDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFile = Join-Path $ToolDir 'bi_config.env'
$SessionFile = Join-Path $ToolDir 'session.json'
$script:CFG = @{}
$script:WebSession = $null
$script:HasSession = $false

# ---- TLS: BI uses a self-signed certificate ----
if ($PSVersionTable.PSVersion.Major -ge 6) {
  $script:Common = @{ SkipCertificateCheck = $true }
} else {
  $script:Common = @{ UseBasicParsing = $true }
  try {
    Add-Type -TypeDefinition @"
using System.Net; using System.Security.Cryptography.X509Certificates;
public class TrustAllCertsPolicy : ICertificatePolicy {
  public bool CheckValidationResult(System.Net.ServicePoint sp, X509Certificate cert, System.Net.WebRequest req, int problem) { return true; }
}
"@ -ErrorAction SilentlyContinue
    [System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAllCertsPolicy
  } catch {}
  [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
}

function Read-Config {
  if (Test-Path -LiteralPath $EnvFile) {
    Get-Content -LiteralPath $EnvFile -Encoding UTF8 | ForEach-Object {
      if ($_ -match '^\s*#') { return }
      if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.*?)\s*$') { $script:CFG[$matches[1]] = $matches[2] }
    }
  }
}

function Need-Config {
  Write-Output @'
[No connection config yet - every machine has its own BI address/company/account. ASK THE USER, never guess defaults.]
Ask the user for 4 items (what they use to log into BI in a browser):
  1. Full BI address incl. port (ports differ per site: 433/88/85...)
  2. Company number incl. dot suffix (e.g. 002.1 / 003.1; bare 002 gives 401)
  3. Username   4. Password
Then run:  powershell -File bi_api.ps1 config <address> <company> <user> <pwd>
'@
  exit 2
}

function Get-CookieString {
  # PS 5.1 DROPS Cookie sent via -Headers (verified); must use -WebSession CookieContainer
  try {
    return ((($script:WebSession.Cookies.GetCookies([Uri]$script:CFG['BI_URL']))) | ForEach-Object { $_.Name + '=' + $_.Value }) -join '; '
  } catch { return $null }
}

function New-SessionFromCookieString([string]$Cookie) {
  $script:WebSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $h = ([Uri]$script:CFG['BI_URL']).Host
  foreach ($p in ($Cookie -split '; ')) {
    $kv = $p -split '=', 2
    if ($kv.Count -eq 2) { $script:WebSession.Cookies.Add((New-Object System.Net.Cookie($kv[0], $kv[1], '/', $h))) }
  }
  $script:HasSession = $true
}

function Load-Session {
  if (-not $script:HasSession -and (Test-Path -LiteralPath $SessionFile)) {
    try {
      $s = Get-Content -LiteralPath $SessionFile -Raw -Encoding UTF8 | ConvertFrom-Json
      if ($s.cookie) { New-SessionFromCookieString ([string]$s.cookie) }
    } catch {}
  }
}

function Save-Session {
  $cookie = Get-CookieString
  [IO.File]::WriteAllText($SessionFile, (ConvertTo-Json -InputObject @{ cookie = $cookie; ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() }))
}

function Invoke-Login {
  $payload = ConvertTo-Json -InputObject @{ username = $script:CFG['BI_USER']; password = $script:CFG['BI_PASSWORD']; companyNumber = $script:CFG['BI_COMPANY']; forceRelogin = $true }
  try {
    $resp = Invoke-WebRequest @script:Common -Method Post -Uri ($script:CFG['BI_URL'] + '/api/account/signin') -ContentType 'application/json' -Body ([Text.Encoding]::UTF8.GetBytes($payload)) -SessionVariable ws
  } catch {
    throw ("Cannot reach BI (" + $_.Exception.Message + "). Likely wrong address/port. Re-run: config <address> <company> <user> <pwd>")
  }
  if ($resp.StatusCode -ne 200) { throw ("Login failed HTTP " + $resp.StatusCode + " - 401=company number needs dot suffix or wrong password; 403=no BI permission. Re-run config.") }
  $script:WebSession = $ws
  $script:HasSession = $true
  $cookie = Get-CookieString
  if (-not $cookie) {
    # fallback: parse comma-joined Set-Cookie manually (keep only name=value tokens)
    $parts = @()
    foreach ($c in @($resp.Headers['Set-Cookie'])) { if ($c) { $t = ($c -split ';')[0]; if ($t -match '^[.\w-]+=') { $parts += $t } } }
    New-SessionFromCookieString ($parts -join '; ')
    $cookie = $parts -join '; '
  }
  [IO.File]::WriteAllText($SessionFile, (ConvertTo-Json -InputObject @{ cookie = $cookie; ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() }))
  Write-Output ("Login OK, user " + $script:CFG['BI_USER'] + " @ " + $script:CFG['BI_URL'])
}

function Get-ErrorBody($Ex) {
  try {
    $stream = $Ex.Exception.Response.GetResponseStream()
    if ($stream) { $reader = New-Object IO.StreamReader($stream); return $reader.ReadToEnd() }
  } catch {}
  return $Ex.Exception.Message
}

function Invoke-BiApi([string]$Method, [string]$Path, $Body = $null) {
  Load-Session
  if (-not $script:HasSession) { Invoke-Login | Out-Null }
  $uri = $script:CFG['BI_URL'] + $Path
  for ($attempt = 1; $attempt -le 2; $attempt++) {
    $p = @{ Method = $Method; Uri = $uri; WebSession = $script:WebSession }
    $p += $script:Common
    if ($null -ne $Body) {
      $p['ContentType'] = 'application/json'
      $p['Body'] = [Text.Encoding]::UTF8.GetBytes($Body)
    }
    try {
      # PS 5.1 decodes charset-less JSON as ISO-8859-1 -> Chinese becomes '?'.
      # MUST decode raw bytes as UTF-8 ourselves (GET) ; also handles empty 200 bodies.
      $r = Invoke-WebRequest @p
      $text = [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
      if ($text.Trim()) { return ($text | ConvertFrom-Json) }
      return $null
    } catch {
      $code = 0
      try { $code = [int]$_.Exception.Response.StatusCode } catch {}
      if ($code -eq 401 -and $attempt -eq 1) { Invoke-Login | Out-Null; continue }
      $body2 = (Get-ErrorBody $_) -replace '\s+', ' '
      throw ("HTTP " + $code + " " + $Method + " " + $Path + ": " + $body2.Substring(0, [Math]::Min(300, $body2.Length)))
    }
  }
}

function Export-DashboardXml([string]$Id, [string]$OutFile) {
  if (-not $script:CFG['PG_PSQL']) { throw 'get-xml needs PG_PSQL configured in bi_config.env (optional section)' }
  $hexFile = Join-Path $ToolDir '_export.hex'
  $env:PGPASSWORD = [string]$script:CFG['PG_PASSWORD']
  & $script:CFG['PG_PSQL'] -h $script:CFG['PG_HOST'] -p $script:CFG['PG_PORT'] -U $script:CFG['PG_USER'] -d $script:CFG['PG_DB'] -tAc ("\copy (select definition from settings.dashboard where id='" + $Id + "') to '" + $hexFile + "'") | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'psql export failed' }
  $hex = (Get-Content -LiteralPath $hexFile -Raw).Trim() -replace '^[\\]+x', '' -replace '\s', ''
  Remove-Item -LiteralPath $hexFile -Force -ErrorAction SilentlyContinue
  $bytes = New-Object System.Collections.Generic.List[byte]
  for ($i = 0; $i -lt $hex.Length; $i += 2) { $bytes.Add([Convert]::ToByte($hex.Substring($i, 2), 16)) }
  [IO.File]::WriteAllBytes($OutFile, $bytes.ToArray())
  $xml = [IO.File]::ReadAllText($OutFile, [Text.Encoding]::UTF8)
  if ($xml.Length -gt 0 -and $xml[0] -eq [char]0xFEFF) { [IO.File]::WriteAllText($OutFile, $xml.Substring(1), (New-Object Text.UTF8Encoding($false))) }
}

# ---------------- commands ----------------
Read-Config

if ($Command -eq 'config') {
  if ($Rest.Count -lt 4) { throw 'Usage: bi_api.ps1 config <url> <company> <user> <pwd>' }
  $content = @(
    '# Monitor BI connection config (generated by config command)',
    ('BI_URL=' + $Rest[0]),
    ('BI_COMPANY=' + $Rest[1]),
    ('BI_USER=' + $Rest[2]),
    ('BI_PASSWORD=' + $Rest[3]),
    '',
    '# Optional: BI server log dir (verify command); keep commented if BI is on another machine',
    '# BI_LOG_DIR=C:\Program Files\Monitor ERP System AB\MONITOR BI Server\Logs',
    '',
    '# Optional: direct DB export of raw XML definitions (get-xml); differs per machine, fill when needed',
    '# PG_PSQL=C:\Program Files\PostgreSQL\18\bin\psql.exe',
    '# PG_HOST=127.0.0.1', '# PG_PORT=5432', '# PG_USER=BIuser', '# PG_DB=BusinessIntelligence', '# PG_PASSWORD=',
    ''
  ) -join "`r`n"
  [IO.File]::WriteAllText($EnvFile, $content, (New-Object Text.UTF8Encoding($true)))
  Read-Config
  Write-Output ('Config saved -> ' + $EnvFile + ', testing login...')
  Invoke-Login
  return
}

foreach ($k in 'BI_URL', 'BI_COMPANY', 'BI_USER', 'BI_PASSWORD') {
  if (-not $script:CFG[$k]) { Need-Config }
}

switch ($Command) {
  'login' { Invoke-Login }
  'list' {
    $r = Invoke-BiApi 'Get' '/api/userdashboard/dashboards'
    $n = 0
    foreach ($cat in $r) { foreach ($d in $cat.dashboards) { Write-Output ('[' + $cat.category + '] ' + $d.name + ' id=' + $d.id + ' std=' + $d.isStandard); $n++ } }
    Write-Output ("Total: $n dashboards")
  }
  'import' {
    if ($Rest.Count -lt 2) { throw 'Usage: import <title> <xmlfile> [categoryId]' }
    $xml = [IO.File]::ReadAllText($ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Rest[1]), [Text.Encoding]::UTF8).TrimStart([char]0xFEFF)
    Invoke-BiApi 'Put' '/api/admin/language/en' | Out-Null
    try {
      $payload = ConvertTo-Json -InputObject @{ Name = $Rest[0]; Xml = $xml; CategoryId = $null } -Depth 6
      $r = Invoke-BiApi 'Post' '/api/userdashboard/import' $payload
      Write-Output ('Imported: ' + ($r | ConvertTo-Json -Compress -Depth 4))
    } finally { try { Invoke-BiApi 'Put' '/api/admin/language/zh' | Out-Null } catch {} }
  }
  'save' {
    if ($Rest.Count -lt 2) { throw 'Usage: save <id> <xmlfile> [newTitle]' }
    $id = $Rest[0]
    $xmlFile = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Rest[1])
    $xml = [IO.File]::ReadAllText($xmlFile, [Text.Encoding]::UTF8).TrimStart([char]0xFEFF)
    $title = $null
    if ($Rest.Count -ge 3) { $title = $Rest[2] }
    Invoke-BiApi 'Put' '/api/admin/language/en' | Out-Null
    try {
      if (-not $title) {
        $cur = Invoke-BiApi 'Get' ('/api/dashboard/dashboards/' + $id)
        $title = $cur.Dashboard.Title.'@Text'
        if (-not $title) { $title = 'Untitled' }
      }
      $payload = ConvertTo-Json -InputObject @{ Name = $title; Xml = $xml; CategoryId = $null } -Depth 6
      $r1 = Invoke-BiApi 'Post' '/api/userdashboard/import' $payload
      $tempId = $r1.dashboardId
      $r2 = Invoke-BiApi 'Get' ('/api/dashboard/dashboards/' + $tempId)
      $bare = $r2.Dashboard
      $json = ConvertTo-Json -InputObject $bare -Depth 64
      Invoke-BiApi 'Post' ('/api/dashboard/dashboards/' + $id) $json | Out-Null
      try { Invoke-BiApi 'Delete' ('/api/userdashboard/' + $tempId) | Out-Null } catch {}
      Write-Output ('In-place save done. Title: ' + $title + ' | ID unchanged: ' + $id.Substring(0, 8))
    } finally { try { Invoke-BiApi 'Put' '/api/admin/language/zh' | Out-Null } catch {} }
    $back = Invoke-BiApi 'Get' ('/api/dashboard/dashboards/' + $id)
    if ($back.Dashboard.Title.'@Text' -eq $title) { Write-Output 'Verify: OK (title matches)' } else { Write-Output 'Verify: WARN title mismatch, check manually' }
  }
  'get' {
    $r = Invoke-BiApi 'Get' ('/api/dashboard/dashboards/' + $Rest[0])
    if ($Rest.Count -ge 2) {
      $out = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Rest[1])
      ConvertTo-Json -InputObject $r -Depth 64 | Out-File -LiteralPath $out -Encoding utf8
      Write-Output ('Written: ' + $out)
    } else { Write-Output ((ConvertTo-Json -InputObject $r -Compress -Depth 64).Substring(0, 400)) }
  }
  'get-xml' {
    $out = if ($Rest.Count -ge 2) { $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Rest[1]) } else { Join-Path (Get-Location) ($Rest[0].Substring(0, 8) + '.xml') }
    Export-DashboardXml $Rest[0] $out
    Write-Output ('Exported: ' + $out)
  }
  'verify' {
    $minutes = 30; if ($Rest.Count -ge 1) { $minutes = [int]$Rest[0] }
    $dir = [string]$script:CFG['BI_LOG_DIR']
    if (-not $dir -or -not (Test-Path $dir)) { Write-Output 'BI_LOG_DIR not configured or missing; skipping log check (optional)'; return }
    $log = Join-Path $dir ('BIServerLog-' + (Get-Date -Format 'yyyyMMdd') + '.txt')
    if (-not (Test-Path $log)) { Write-Output ('No log file for today: ' + $log); return }
    $cutoff = (Get-Date).AddMinutes(-$minutes)
    $sql = 0; $err = 0; $sqlLines = @(); $errLines = @()
    foreach ($l in (Get-Content -LiteralPath $log -Encoding UTF8)) {
      if ($l -notmatch '^(\d{4}-\d{2}-\d{2} [\d:.]+) ') { continue }
      $ts = [datetime]::ParseExact($matches[1].Trim(), 'yyyy-MM-dd HH:mm:ss.fff', $null)
      if ($ts -lt $cutoff) { continue }
      if ($l -match 'Dashboard SQL') { $sql++; $sqlLines += $l }
      if ($l -match '\[ERR\]|responded 5\d\d') { $err++; $errLines += $l }
    }
    Write-Output ("Last $minutes min: SQL lines=$sql errors=$err")
    $sqlLines | Select-Object -Last 4 | ForEach-Object { Write-Output ('  SQL: ' + $_.Substring(0, [Math]::Min(150, $_.Length))) }
    $errLines | Select-Object -Last 3 | ForEach-Object { Write-Output ('  ERR: ' + $_.Substring(0, [Math]::Min(180, $_.Length))) }
  }
  'backup' {
    if ($Rest.Count -lt 1) { throw 'Usage: backup <id ...>' }
    Load-Session; if (-not $script:HasSession) { Invoke-Login | Out-Null }
    $p = @{ Method = 'Post'; Uri = ($script:CFG['BI_URL'] + '/api/userdashboard/backup'); WebSession = $script:WebSession; ContentType = 'application/json'; Body = [Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject @($Rest))) }
    $p += $script:Common
    $dir = Join-Path $ToolDir 'backups'; New-Item -ItemType Directory -Path $dir -Force | Out-Null
    $file = Join-Path $dir ('dashboards-' + (Get-Date -Format 'yyyy-MM-dd-HH-mm') + '.zip')
    Invoke-WebRequest @p -OutFile $file | Out-Null
    Write-Output ('Backup OK: ' + $file + ' (' + (Get-Item $file).Length + ' bytes)')
  }
  'delete' { Invoke-BiApi 'Delete' ('/api/userdashboard/' + $Rest[0]) | Out-Null; Write-Output ('Deleted: ' + $Rest[0]) }
  'lang' { Invoke-BiApi 'Put' ('/api/admin/language/' + $Rest[0]) | Out-Null; Write-Output ('Language: ' + $Rest[0]) }
  default { Write-Output 'Unknown command. Available: config login list import save get get-xml verify backup delete lang' }
}
