@echo off
title AI Web Scraper - Launcher
color 0E

echo ==========================================================
echo    AI WEB SCRAPER // PRECISION INSTRUMENT WORKBENCH
echo ==========================================================
echo.

cd /d "%~dp0"

:: 1. Clear foreign virtual environment inherited from other projects
set VIRTUAL_ENV=
set PYTHONHOME=

:: 2. Find Python executable containing project dependencies
set "PYTHON_EXE=C:\Users\Kullo\AppData\Local\Programs\Python\Python312\python.exe"
if not exist "%PYTHON_EXE%" (
    set "PYTHON_EXE=py -3.12"
)

echo [1/2] Starting FastAPI Backend on http://127.0.0.1:8000...
start "AI Scraper - Backend API" cmd /k "color 0A && title AI Scraper Backend (8000) && %PYTHON_EXE% -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload"

timeout /t 2 /nobreak >nul

echo [2/2] Starting Vite React UI on http://localhost:5173...
cd /d "%~dp0frontend"
start "AI Scraper - Frontend UI" cmd /k "color 0B && title AI Scraper UI (5173) && npm run dev"

timeout /t 2 /nobreak >nul

echo.
echo Opening browser to http://localhost:5173...
start http://localhost:5173

echo.
echo ==========================================================
echo [SUCCESS] Both services launched in separate windows!
echo - UI Workbench: http://localhost:5173
echo - API Docs:     http://localhost:8000/docs
echo ==========================================================
echo.
pause