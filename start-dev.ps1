# Start Script for AI Web Scraper Precision Workbench
Write-Host "==========================================================" -ForegroundColor DarkYellow
Write-Host "   AI WEB SCRAPER // PRECISION INSTRUMENT WORKBENCH       " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor DarkYellow

$ROOT_DIR = $PSScriptRoot

# 1. Clear any foreign virtual environment from current terminal
$env:VIRTUAL_ENV = $null
$env:PYTHONHOME = $null

$pythonExe = "C:\Users\Kullo\AppData\Local\Programs\Python\Python312\python.exe"
if (-not (Test-Path $pythonExe)) {
    $pythonExe = "py"
}

# 2. Start FastAPI backend on Port 8000
Write-Host "`n[1/2] Starting FastAPI Backend on http://127.0.0.1:8000..." -ForegroundColor Cyan
$backendProcess = Start-Process -FilePath $pythonExe -ArgumentList "-m", "uvicorn", "api.main:app", "--host", "127.0.0.1", "--port", "8000" -WorkingDirectory $ROOT_DIR -PassThru

Start-Sleep -Seconds 2

# 3. Start Vite React Frontend on Port 5173
Write-Host "[2/2] Starting Vite Frontend on http://localhost:5173..." -ForegroundColor Green
$frontendDir = Join-Path $ROOT_DIR "frontend"
Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory $frontendDir

Start-Sleep -Seconds 2
Start-Process "http://localhost:5173"

Write-Host "`n[SUCCESS] System Online:" -ForegroundColor Green
Write-Host "  - UI Workbench: http://localhost:5173" -ForegroundColor White
Write-Host "  - API Swagger:  http://localhost:8000/docs" -ForegroundColor White
Write-Host "`nPress Ctrl+C or close the terminal windows to stop." -ForegroundColor DarkGray