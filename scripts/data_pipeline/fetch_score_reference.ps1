param(
    [string]$Revision = 'main',
    [ValidateRange(2000, 2100)][int]$Season = 2022,
    [string]$OutputPath = 'data/reference/nba-scores.json',
    [string]$SplitDate = '2022-02-01',
    [long]$ReleaseAssetId = 0
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '../..')
$destination = [IO.Path]::GetFullPath((Join-Path $root $OutputPath))
if (($Season -ne 2022 -or $ReleaseAssetId) -and $destination -eq (Join-Path $root 'data/reference/nba-scores.json')) {
    throw 'A new season requires a separate OutputPath; preserve the original reference.'
}
if ($Season -ne 2022 -and (Test-Path $destination)) {
    throw 'The new reference already exists; choose a separate OutputPath to preserve its evidence.'
}
$commit = $null
$asset = $null
if ($ReleaseAssetId) {
    $asset = (Invoke-WebRequest "https://api.github.com/repos/sportsdataverse/sportsdataverse-data/releases/assets/$ReleaseAssetId" -UseBasicParsing).Content | ConvertFrom-Json
    if ($asset.name -ne "nba_schedule_$Season.csv" -or $asset.digest -notmatch '^sha256:[0-9a-f]{64}$') {
        throw 'Release asset must identify the requested season CSV with a SHA-256 digest.'
    }
} else {
    $commit = ((Invoke-WebRequest "https://api.github.com/repos/sportsdataverse/hoopR-data/commits/$Revision" -UseBasicParsing).Content | ConvertFrom-Json).sha
    if ($commit -notmatch '^[0-9a-f]{40}$') { throw 'Archive revision did not resolve to a commit.' }
}
$sources = @()
$games = @()
function Get-ContentHash([byte[]]$Content) {
    $hasher = [Security.Cryptography.SHA256]::Create()
    $hash = [BitConverter]::ToString($hasher.ComputeHash($Content)).Replace('-', '').ToLowerInvariant()
    $hasher.Dispose()
    return $hash
}
foreach ($seasonYear in @($Season)) {
    $season = $seasonYear
    $url = "https://raw.githubusercontent.com/sportsdataverse/hoopR-data/$commit/nba/schedules/csv/nba_schedule_$season.csv"
    if ($asset) { $url = $asset.browser_download_url }
    $response = Invoke-WebRequest $url -UseBasicParsing
    $sourceBytes = $response.RawContentStream.ToArray()
    $sourceHash = Get-ContentHash $sourceBytes
    if ($asset -and "sha256:$sourceHash" -ne $asset.digest) { throw 'Downloaded release asset digest mismatch.' }
    $archive = @([Text.Encoding]::UTF8.GetString($sourceBytes) | ConvertFrom-Csv | Where-Object {
        $_.season_type -eq '2' -and $_.type_abbreviation -eq 'STD'
    })
    $complete = @($archive | Where-Object status_type_completed -EQ 'TRUE')
    $source = [ordered]@{ season = $season; url = $url; sha256 = $sourceHash; completedGames = $complete.Count }
    if ($asset) { $source.releaseAssetId = $asset.id; $source.assetUpdatedUtc = $asset.updated_at }
    $sources += $source
    $byId = @{}
    foreach ($row in $complete) {
        if ($byId.ContainsKey($row.id)) { throw "Duplicate archived game $($row.id)." }
        $byId[$row.id] = $row
    }
    $rows = @($byId.Values)
    if ($rows.Count -ne 1230) { throw "Expected 1230 regular-season games in $season; got $($rows.Count)." }
    if (@($rows.id | Sort-Object -Unique).Count -ne 1230) { throw "Duplicate game IDs in $season." }
    $teamCounts = @{}
    foreach ($row in $rows) {
        foreach ($field in @('home_score', 'away_score', 'status_period', 'format_regulation_periods')) {
            $value = [decimal]0
            if (-not [decimal]::TryParse($row.$field, [Globalization.NumberStyles]::AllowDecimalPoint,
                [Globalization.CultureInfo]::InvariantCulture, [ref]$value) -or
                $value -lt 0 -or $value -gt [int]::MaxValue -or [decimal]::Truncate($value) -ne $value) {
                throw "Invalid $field in $($row.id)."
            }
        }
        if ([int]$row.format_regulation_periods -ne 4 -or [int]$row.status_period -lt 4 -or [int]$row.home_score -eq [int]$row.away_score) {
            throw "Invalid completed game $($row.id)."
        }
        if ($row.home_id -eq $row.away_id -or [int]$row.season -ne $season) { throw "Invalid identity in $($row.id)." }
        foreach ($team in @($row.home_id, $row.away_id)) { $teamCounts[$team]++ }
        $games += [ordered]@{
            id = $row.id; season = $season; date = $row.date
            home = $row.home_id; away = $row.away_id
            homeScore = [int]$row.home_score; awayScore = [int]$row.away_score
            overtime = [int]$row.status_period - 4
        }
    }
    if ($teamCounts.Count -ne 30 -or @($teamCounts.Values | Where-Object { $_ -ne 82 }).Count) {
        throw "Incomplete team schedules in $season."
    }
    Write-Host "$season validated: $($rows.Count) games, 30 teams, 82 games per team."
}
$result = [ordered]@{
    schemaVersion = 1
    provider = $(if ($asset) { 'ESPN via sportsdataverse/sportsdataverse-data' } else { 'ESPN via sportsdataverse/hoopR-data' })
    commit = $commit
    retrievedUtc = [DateTime]::UtcNow.ToString('o')
    season = $Season
    splitDate = $SplitDate
    sources = $sources
    games = @($games | Sort-Object { $_.date }, { $_.id })
}
$directory = Split-Path $destination -Parent
[IO.Directory]::CreateDirectory($directory) | Out-Null
[IO.File]::WriteAllText($destination, ($result | ConvertTo-Json -Depth 6 -Compress) + "`n", [Text.UTF8Encoding]::new($false))
