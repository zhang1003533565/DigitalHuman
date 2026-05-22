@echo off
setlocal

cd /d "%~dp0"

if "%HOST%"=="" set HOST=127.0.0.1
if "%PORT%"=="" set PORT=18755

if exist ".venv\Scripts\python.exe" (
  set "PYTHON_BIN=.venv\Scripts\python.exe"
) else (
  where python >nul 2>nul
  if not errorlevel 1 (
    set "PYTHON_BIN=python"
  ) else (
    where py >nul 2>nul
    if not errorlevel 1 (
      set "PYTHON_BIN=py"
    ) else (
      echo Error: python not found.
      echo Please install Python 3.11+ or create ai-service\.venv first.
      exit /b 1
    )
  )
)

echo Starting ai-service on http://%HOST%:%PORT%
echo Using Python: %PYTHON_BIN%

%PYTHON_BIN% -m uvicorn app:app --host %HOST% --port %PORT%
