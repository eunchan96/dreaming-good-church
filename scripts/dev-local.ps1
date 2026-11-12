$ErrorActionPreference = 'Stop'
$localStatus = npx --no-install supabase status -o json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $localStatus.API_URL -ne 'http://127.0.0.1:54321') { throw 'Local Supabase must be running.' }
# Process-only overrides: preserve the user's hosted .env.local unchanged.
$env:NEXT_PUBLIC_SUPABASE_URL = $localStatus.API_URL
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = $localStatus.PUBLISHABLE_KEY
node node_modules/next/dist/bin/next dev --port 3001
