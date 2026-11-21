# Бэкап всего, что не лежит в git: ключи и копилки моста (config.json, data/), сцены и профили OBS.
# Запуск — двойной клик по backup.cmd. Архив кладётся в «Документы\Stream backup».
$ErrorActionPreference = 'Stop'
$bridge = $PSScriptRoot
$dest = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Stream backup'
$stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm'
$tmp = Join-Path $env:TEMP "stream-backup-$stamp"
New-Item -ItemType Directory -Force $dest, "$tmp\bridge" | Out-Null

if (Test-Path "$bridge\config.json") { Copy-Item "$bridge\config.json" "$tmp\bridge\" }
if (Test-Path "$bridge\data") {
  Copy-Item "$bridge\data" "$tmp\bridge\data" -Recurse
  Get-ChildItem "$tmp\bridge\data" -Filter 'bridge.log*' | Remove-Item -Force   # журнал не нужен
}
$obs = Join-Path $env:APPDATA 'obs-studio\basic'
if (Test-Path $obs) { Copy-Item $obs "$tmp\obs-basic" -Recurse }

$zip = Join-Path $dest "stream-backup-$stamp.zip"
Compress-Archive -Path "$tmp\*" -DestinationPath $zip
Remove-Item $tmp -Recurse -Force
Write-Host "Готово: $zip"
Write-Host 'Внутри ключи DonationAlerts и ключ стрима OBS. Храни у себя (флешка, личное облако), никуда не выкладывай.'
