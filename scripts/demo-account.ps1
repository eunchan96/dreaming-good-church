$ErrorActionPreference = 'Stop'
$localStatus = npx --no-install supabase status -o json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $localStatus.API_URL -ne 'http://127.0.0.1:54321') { throw 'Expected local Supabase at 127.0.0.1:54321.' }
$env:DEMO_SUPABASE_URL = $localStatus.API_URL
$env:DEMO_SERVICE_KEY = $localStatus.SERVICE_ROLE_KEY
try {
    node scripts/demo-account.mjs
    $demoExitCode = $LASTEXITCODE
} finally {
    Remove-Item Env:DEMO_SUPABASE_URL, Env:DEMO_SERVICE_KEY -ErrorAction SilentlyContinue
}
exit $demoExitCode
