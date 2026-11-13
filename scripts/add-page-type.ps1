
# Adds pageType="ServicePage" to every <Layout ... > tag in the given files
# that doesn't already have a pageType prop.

$servicePaths = @(
  "src\pages\services\index.astro",
  "src\pages\services\cloud-identity\index.astro",
  "src\pages\services\directory-services\index.astro",
  "src\pages\services\iam-consulting\index.astro",
  "src\pages\services\identity-governance\index.astro",
  "src\pages\services\implementation-integration\index.astro",
  "src\pages\services\platform-services\index.astro",
  "src\pages\solutions\index.astro",
  "src\pages\solutions\customer-identity\index.astro",
  "src\pages\solutions\hybrid-identity\index.astro",
  "src\pages\solutions\identity-governance\index.astro",
  "src\pages\solutions\privileged-access\index.astro",
  "src\pages\solutions\workforce-identity\index.astro"
)

$root = "c:\Users\krish\Downloads\blooming-systems"

foreach ($rel in $servicePaths) {
  $path = Join-Path $root $rel
  $content = Get-Content $path -Raw
  if ($content -match 'pageType=') {
    Write-Host "SKIP (already has pageType): $rel"
    continue
  }
  # Insert pageType before the closing > of the first <Layout ... >
  # Pattern: find <Layout followed by props ending with \n>
  $newContent = $content -replace '(<Layout[^>]+?)([\r\n]+>)', '$1
  pageType="ServicePage"$2'
  if ($newContent -eq $content) {
    Write-Host "NO MATCH: $rel"
  } else {
    Set-Content $path $newContent -NoNewline
    Write-Host "UPDATED: $rel"
  }
}

