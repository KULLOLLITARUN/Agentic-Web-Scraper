@echo off
title Markpull - Launcher
color 0E

echo ==========================================================
echo    MARKPULL // AI WEB SCRAPER
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

echo [1/2] Starting FastAPI Backend on http://127.0.0.1:8001...
start "Markpull - Backend API" cmd /k "color 0A && title Markpull Backend (8001) && %PYTHON_EXE% -m uvicorn api.main:app --host 127.0.0.1 --port 8001"

timeout /t 2 /nobreak >nul

echo [2/2] Starting Vite React UI on http://localhost:5173...
cd /d "%~dp0frontend"
start "Markpull - App" cmd /k "color 0B && title Markpull App (5173) && npm run dev"

timeout /t 2 /nobreak >nul

echo.
echo Opening browser to http://localhost:5173...
start http://localhost:5173

echo.
echo ==========================================================
echo [SUCCESS] Both services launched in separate windows!
echo - UI Workbench: http://localhost:5173
echo - API Docs:     http://localhost:8001/docs
echo ==========================================================
echo.
pause