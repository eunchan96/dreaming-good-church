$ErrorActionPreference = 'Stop'
$localStatus = npx --no-install supabase status -o json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $localStatus.API_URL -ne 'http://127.0.0.1:54321') { throw 'Local Supabase must be running.' }
$env:LOCAL_SUPABASE_ANON_KEY = $localStatus.ANON_KEY
$env:LOCAL_SUPABASE_SERVICE_KEY = $localStatus.SERVICE_ROLE_KEY
try {
    node --test tests/drafts.integration.mjs tests/publication.integration.mjs
    $testExitCode = $LASTEXITCODE
} finally {
    Remove-Item Env:LOCAL_SUPABASE_ANON_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:LOCAL_SUPABASE_SERVICE_KEY -ErrorAction SilentlyContinue
}
exit $testExitCode
