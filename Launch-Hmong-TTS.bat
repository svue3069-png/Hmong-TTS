@echo off
setlocal
cd /d "%~dp0"

echo Starting Hmong TTS...

for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3000 .*LISTENING"') do set "SERVER_PID=%%P"
if defined SERVER_PID (
  echo The server is already running.
  start "" "http://localhost:3000"
  exit /b 0
)

if not exist "node_modules\.bin\tsx.cmd" (
  echo Dependencies are missing. Installing them now...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
	echo.
	echo Dependency installation failed. See the error above.
	pause
	exit /b 1
  )
)

start "Hmong TTS Server" cmd /k "cd /d "%~dp0" && npm run dev"
timeout /t 3 /nobreak >nul
start "" "http://localhost:3000"

echo.
echo Hmong TTS is running at http://localhost:3000
echo Keep the server window open while using the app.
