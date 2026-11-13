$ErrorActionPreference = 'Stop'
$localStatus = npx --no-install supabase status -o json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $localStatus.API_URL -ne 'http://127.0.0.1:54321') { throw 'Local Supabase must be running.' }
$env:LOCAL_SUPABASE_ANON_KEY = $localStatus.ANON_KEY
$env:LOCAL_SUPABASE_SERVICE_KEY = $localStatus.SERVICE_ROLE_KEY
try {
    node --experimental-strip-types --test --test-concurrency=1 tests/access.integration.mjs tests/copy-visibility.integration.mjs tests/drafts.integration.mjs tests/publication.integration.mjs tests/community.integration.mjs tests/church.integration.mjs
    $testExitCode = $LASTEXITCODE
    if ($testExitCode -eq 0) {
        # psql supports the multi-statement transaction that db query prepares as
        # a single statement. The fixed container is this project's local DB.
        Get-Content -LiteralPath tests/community-boundaries.sql -Raw | docker exec -i supabase_db_dreaming-good-church psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q
        $testExitCode = $LASTEXITCODE
        if ($testExitCode -eq 0) { Write-Output 'Community period RLS: 11 exact boundary/state cases passed (rolled back).' }
    }
} finally {
    Remove-Item Env:LOCAL_SUPABASE_ANON_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:LOCAL_SUPABASE_SERVICE_KEY -ErrorAction SilentlyContinue
}
exit $testExitCode
