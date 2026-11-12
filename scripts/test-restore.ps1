$ErrorActionPreference = 'Stop'
# Deliberately has no remote/connection-string parameter. Never restores postgres.
$container = 'supabase_db_dreaming-good-church'
$suffix = [guid]::NewGuid().ToString('N')
$restoreDb = "church_restore_$suffix"
$dumpPath = "/tmp/church_restore_$suffix.dump"
$created = $false
$started = Get-Date
function Invoke-DockerChecked {
    param([string[]]$DockerArgs)
    $result = & docker @DockerArgs
    if ($LASTEXITCODE -ne 0) { throw "Local restore drill command failed: $($DockerArgs[0])" }
    return $result
}
function Read-LocalSql {
    param([string]$Database, [string]$Sql)
    $result = $Sql | docker exec -i $container psql -X -U supabase_admin -d $Database -At -v ON_ERROR_STOP=1
    if ($LASTEXITCODE -ne 0) { throw 'Local restore verification SQL failed.' }
    return ($result -join "`n")
}
$schemaArgs = @('-n','public','-n','private','-n','auth','-n','storage','-n','extensions','-n','supabase_migrations')
# Compare row contents without displaying account data or private bulletin text.
$tableQueries = Read-LocalSql 'postgres' @'
select format('select %L || '':'' || count(*) || '':'' || md5(coalesce(string_agg(row_hash, '''' order by row_hash),'''')) from (select md5(to_jsonb(t)::text) row_hash from %I.%I t) rows;',
 schemaname||'.'||tablename,schemaname,tablename)
from pg_tables where schemaname in ('public','private','auth','storage','supabase_migrations')
order by schemaname,tablename;
'@
$catalogQueries = @'
select 'policies:'||md5(coalesce(string_agg(to_jsonb(p)::text,'' order by schemaname,tablename,policyname),'')) from pg_policies p where schemaname in ('public','private','auth','storage');
select 'tables:'||md5(coalesce(string_agg(concat_ws('|',n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner),
 (select string_agg(concat_ws(',',e.grantor,e.grantee,e.privilege_type,e.is_grantable),';' order by e.grantor,e.grantee,e.privilege_type,e.is_grantable) from aclexplode(coalesce(c.relacl,acldefault(case when c.relkind='S' then 's'::"char" else 'r'::"char" end,c.relowner))) e)),'' order by n.nspname,c.relname),'')) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','auth','storage') and c.relkind in ('r','p','v','S');
select 'columns:'||md5(coalesce(string_agg(concat_ws('|',table_schema,table_name,column_name,grantee,privilege_type),'' order by table_schema,table_name,column_name,grantee,privilege_type),'')) from information_schema.column_privileges where table_schema in ('public','auth','storage');
select 'functions:'||md5(coalesce(string_agg(concat_ws('|',n.nspname,p.proname,pg_get_functiondef(p.oid),pg_get_userbyid(p.proowner),p.proacl::text),'' order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),'')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f';
'@
$fingerprintSql = "$tableQueries`n$catalogQueries"
$before = Read-LocalSql 'postgres' $fingerprintSql
try {
    Invoke-DockerChecked -DockerArgs (@('exec',$container,'pg_dump','-U','supabase_admin','-d','postgres','-Fc','-f',$dumpPath) + $schemaArgs) | Out-Null
    Invoke-DockerChecked -DockerArgs @('exec',$container,'createdb','-U','supabase_admin','-T','template0',$restoreDb) | Out-Null
    $created = $true
    # Empty template databases still contain public; remove it ONLY in our new DB.
    Read-LocalSql $restoreDb 'drop schema public;' | Out-Null
    Invoke-DockerChecked -DockerArgs @('exec',$container,'pg_restore','-U','supabase_admin','-d',$restoreDb,'--exit-on-error','--single-transaction',$dumpPath) | Out-Null
    $restored = Read-LocalSql $restoreDb $fingerprintSql
    if ($before -cne $restored) {
        $changed = Compare-Object ($before -split "`n") ($restored -split "`n") | ForEach-Object { ($_.InputObject -split ':')[0] } | Sort-Object -Unique
        throw "Restored fingerprint differs: $($changed -join ', ')"
    }
    $acceptance = Get-Content -LiteralPath (Join-Path $PSScriptRoot '../tests/restore-acceptance.sql') -Raw
    Read-LocalSql $restoreDb $acceptance | Out-Null
    $after = Read-LocalSql 'postgres' $fingerprintSql
    if ($before -cne $after) { throw 'Source changed during the drill; stop local editing and repeat.' }
    $reportDir = Join-Path $PSScriptRoot '../.local/restore-drill'
    New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
    [ordered]@{
        completedAt = (Get-Date).ToUniversalTime().ToString('o')
        elapsedSeconds = [math]::Round(((Get-Date)-$started).TotalSeconds,2)
        scope = 'Local public/private/auth/storage/extensions/migration history; existing cluster roles'
        matchedTables = @($tableQueries -split "`n" | Where-Object { $_ }).Count
        dataAndPermissionsMatched = $true
        restoredRlsAndPublicationPassed = $true
        sourceUnchanged = $true
        storageFileBytesTested = $false
        cloudRestoreTested = $false
    } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $reportDir 'result.json') -Encoding utf8
    Write-Output 'Restore passed: rows, policies, grants, owners, functions, migration history, anonymous/editor/revoked access and publication. Source unchanged.'
} finally {
    # Both names are generated above, never supplied by callers.
    if ($restoreDb -notmatch '^church_restore_[a-f0-9]{32}$' -or $dumpPath -notmatch '^/tmp/church_restore_[a-f0-9]{32}\.dump$') { throw 'Unsafe drill cleanup target.' }
    if ($created) { Invoke-DockerChecked -DockerArgs @('exec',$container,'dropdb','-U','supabase_admin',$restoreDb) | Out-Null }
    Invoke-DockerChecked -DockerArgs @('exec',$container,'rm','-f','--',$dumpPath) | Out-Null
    Write-Output 'Temporary local restore database and dump removed.'
}
