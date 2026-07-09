$regions = "eu-central-1", "us-east-1", "us-west-1", "ap-southeast-1", "ap-northeast-1", "sa-east-1", "ca-central-1", "eu-west-1", "eu-west-2", "eu-west-3", "eu-north-1", "me-central-1", "ap-south-1", "ap-southeast-2"
$project = "mkcwwrxwfhjpafiiqvzq"
$pass = "CKkGLUUiRbPxICLq"

foreach ($region in $regions) {
    Write-Host "Checking $region..." -NoNewline
    $env:DATABASE_URL = "postgresql://postgres.$($project):$($pass)@aws-0-$($region).pooler.supabase.com:6543/postgres?pgbouncer=true"
    $result = npx prisma db pull --print 2>&1 | Out-String
    if ($result -match "Prisma schema loaded") {
        Write-Host " ✅ FOUND!"
        break
    } elseif ($result -match "tenant/user .* not found") {
        Write-Host " wrong region"
    } else {
        Write-Host " error: " -NoNewline
        Write-Host $result.Substring(0, [Math]::Min(100, $result.Length))
    }
}
