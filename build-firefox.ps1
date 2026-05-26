$ErrorActionPreference = "Stop"

$dist = Join-Path $PSScriptRoot "dist-firefox"
$zip = Join-Path $PSScriptRoot "universal-qr-camera-utility.zip"

if (Test-Path $dist) {
  Remove-Item -LiteralPath $dist -Recurse -Force
}

New-Item -ItemType Directory -Path $dist | Out-Null

$items = @(
  "background.js",
  "icons",
  "popup",
  "content"
)

foreach ($item in $items) {
  $source = Join-Path $PSScriptRoot $item
  $target = Join-Path $dist $item
  Copy-Item -LiteralPath $source -Destination $target -Recurse
}

Copy-Item -LiteralPath (Join-Path $PSScriptRoot "manifest.firefox.json") -Destination (Join-Path $dist "manifest.json")

if (Test-Path $zip) {
  Remove-Item -LiteralPath $zip -Force
}

Add-Type -AssemblyName "System.IO.Compression"
Add-Type -AssemblyName "System.IO.Compression.FileSystem"

$zipStream = [System.IO.File]::Create($zip)
$archive = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create)

$files = Get-ChildItem -Path $dist -Recurse -File
foreach ($file in $files) {
  # Calculate relative path from dist directory
  $relativePath = $file.FullName.Substring($dist.Length + 1)
  # Force Unix-style forward slashes
  $unixPath = $relativePath.Replace("\", "/")
  
  # Write entry into zip
  $entry = $archive.CreateEntry($unixPath)
  $entryStream = $entry.Open()
  $fileStream = [System.IO.File]::OpenRead($file.FullName)
  $fileStream.CopyTo($entryStream)
  
  $fileStream.Close()
  $entryStream.Close()
}

$archive.Dispose()
$zipStream.Close()

Write-Host "Built $zip with normalized Unix forward-slashes!"
