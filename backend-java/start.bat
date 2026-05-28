@echo off
setlocal

cd /d "%~dp0"

if "%PORT%"=="" set PORT=8080
if "%DB_HOST%"=="" set DB_HOST=127.0.0.1
if "%DB_PORT%"=="" set DB_PORT=3306
if "%DB_USERNAME%"=="" set DB_USERNAME=root
if "%DB_PASSWORD%"=="" set DB_PASSWORD=123456
if "%DB_NAME%"=="" set DB_NAME=digitalhuman

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

set "MYSQL_RUNNING="
for /f "delims=" %%i in ('%DOCKER_COMPOSE_CMD% ps --services --status running 2^>nul') do (
  if /i "%%i"=="mysql" set "MYSQL_RUNNING=1"
)

if "%MYSQL_RUNNING%"=="1" (
  echo MySQL container is already running. Skip Docker startup.
) else (
  echo MySQL is not running. Starting backend Docker services ...
  %DOCKER_COMPOSE_CMD% up -d
  if errorlevel 1 exit /b 1
)

echo Ensuring MySQL database exists: %DB_NAME%
%DOCKER_COMPOSE_CMD% exec -T mysql mysql -uroot -p%DB_PASSWORD% -e "CREATE DATABASE IF NOT EXISTS `%DB_NAME%` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" >nul 2>nul
if errorlevel 1 (
  echo MySQL is not ready yet. Waiting briefly and retrying database initialization ...
  timeout /t 5 >nul
  %DOCKER_COMPOSE_CMD% exec -T mysql mysql -uroot -p%DB_PASSWORD% -e "CREATE DATABASE IF NOT EXISTS `%DB_NAME%` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
  if errorlevel 1 exit /b 1
)

set "MVN_CMD="
if exist "mvnw.cmd" (
  set "MVN_CMD=mvnw.cmd"
) else (
  where mvn >nul 2>nul
  if not errorlevel 1 (
    set "MVN_CMD=mvn"
  )
)
if "%MVN_CMD%"=="" (
  echo Error: mvnw.cmd/mvn not found.
  echo Please install Maven or keep backend-java\mvnw.cmd in this project.
  exit /b 1
)

echo Starting backend-java on http://127.0.0.1:%PORT%
echo Using Maven command: %MVN_CMD%

%MVN_CMD% spring-boot:run -Dspring-boot.run.jvmArguments="-Dserver.port=%PORT% -DDB_HOST=%DB_HOST% -DDB_PORT=%DB_PORT% -DDB_NAME=%DB_NAME% -DDB_USERNAME=%DB_USERNAME% -DDB_PASSWORD=%DB_PASSWORD%"
