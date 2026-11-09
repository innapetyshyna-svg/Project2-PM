Set-Location (Join-Path $PSScriptRoot "..")

docker build -t pm-app .
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
docker rm -f pm-app *> $null
New-Item -ItemType Directory -Force data | Out-Null
docker run -d --name pm-app -p 8000:8000 --env-file .env -v "${PWD}/data:/app/data" pm-app
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Running at http://127.0.0.1:8000"
