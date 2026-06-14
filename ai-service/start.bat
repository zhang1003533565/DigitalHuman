@echo off
setlocal

cd /d "%~dp0"

if "%HOST%"=="" set HOST=127.0.0.1
if "%PORT%"=="" set PORT=18755
if "%VENV_DIR%"=="" set "VENV_DIR=.venv"
if "%RUN_MODE%"=="" set "RUN_MODE=local"

set "PYTHON_BIN=%VENV_DIR%\Scripts\python.exe"
if not exist "%PYTHON_BIN%" (
  if exist "venv\Scripts\python.exe" if /i "%VENV_DIR%"==".venv" (
    set "PYTHON_BIN=venv\Scripts\python.exe"
  ) else (
    set "BOOTSTRAP_PYTHON="
    where python >nul 2>nul
    if not errorlevel 1 set "BOOTSTRAP_PYTHON=python"
    if "%BOOTSTRAP_PYTHON%"=="" (
      where py >nul 2>nul
      if not errorlevel 1 set "BOOTSTRAP_PYTHON=py -3"
    )
    if "%BOOTSTRAP_PYTHON%"=="" (
      echo Error: python not found.
      echo Please install Python 3.11+ first.
      exit /b 1
    )

    echo Creating virtual environment at %VENV_DIR% ...
    %BOOTSTRAP_PYTHON% -m venv "%VENV_DIR%"
    if errorlevel 1 exit /b 1
    set "PYTHON_BIN=%VENV_DIR%\Scripts\python.exe"
  )
)

if not exist "%PYTHON_BIN%" (
  echo Error: virtual environment bootstrap failed.
  exit /b 1
)

echo Installing Python dependencies ...
"%PYTHON_BIN%" -m pip install --upgrade pip
if errorlevel 1 exit /b 1
"%PYTHON_BIN%" -m pip install -r requirements.txt
if errorlevel 1 exit /b 1

where docker >nul 2>nul
if errorlevel 1 (
  echo Error: docker command not found.
  echo Please install Docker Desktop first.
  exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
  echo Error: Docker engine is not running.
  echo Please start Docker Desktop and try again.
  exit /b 1
)

set "DOCKER_COMPOSE_CMD=docker compose"
docker compose version >nul 2>nul
if errorlevel 1 (
  where docker-compose >nul 2>nul
  if errorlevel 1 (
    echo Error: docker compose command not found.
    exit /b 1
  )
  set "DOCKER_COMPOSE_CMD=docker-compose"
)

if /i "%RUN_MODE%"=="docker" (
  echo Starting ai-service Docker service ...
  %DOCKER_COMPOSE_CMD% up -d
  if errorlevel 1 exit /b 1
  echo ai-service is running in Docker. Local uvicorn startup is skipped.
  echo Visit: http://%HOST%:%PORT%/health
  exit /b 0
)

echo Starting ai-service on http://%HOST%:%PORT%
echo Using Python: %PYTHON_BIN%

%PYTHON_BIN% -m uvicorn app:app --host %HOST% --port %PORT%
