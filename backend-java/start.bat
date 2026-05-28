@echo off
setlocal

cd /d "%~dp0"

if "%PORT%"=="" set PORT=8080
if "%DB_HOST%"=="" set DB_HOST=127.0.0.1
if "%DB_PORT%"=="" set DB_PORT=3306
if "%DB_USERNAME%"=="" set DB_USERNAME=root
if "%DB_PASSWORD%"=="" set DB_PASSWORD=123456
if "%WAIT_SECONDS%"=="" set WAIT_SECONDS=180

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

echo Starting mysql and redis with Docker ...
%DOCKER_COMPOSE_CMD% up -d mysql redis
if errorlevel 1 exit /b 1

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

echo Waiting for MySQL to be healthy (timeout: %WAIT_SECONDS%s) ...
set /a ELAPSED=0
:wait_mysql
set "MYSQL_STATE="
for /f "tokens=2 delims=:," %%i in ('%DOCKER_COMPOSE_CMD% ps --format json mysql ^| findstr /i "\"Health\""') do (
  set "MYSQL_STATE=%%~i"
)
set "MYSQL_STATE=%MYSQL_STATE: =%"
set "MYSQL_STATE=%MYSQL_STATE:\"=%"

if /i "%MYSQL_STATE%"=="healthy" goto mysql_ready
if %ELAPSED% GEQ %WAIT_SECONDS% (
  echo Error: MySQL did not become healthy within %WAIT_SECONDS%s.
  %DOCKER_COMPOSE_CMD% ps
  exit /b 1
)
timeout /t 2 >nul
set /a ELAPSED+=2
goto wait_mysql

:mysql_ready
echo Starting backend-java on http://127.0.0.1:%PORT%
echo Using Maven command: %MVN_CMD%

%MVN_CMD% spring-boot:run -Dspring-boot.run.jvmArguments="-Dserver.port=%PORT% -DDB_HOST=%DB_HOST% -DDB_PORT=%DB_PORT% -DDB_USERNAME=%DB_USERNAME% -DDB_PASSWORD=%DB_PASSWORD%"
