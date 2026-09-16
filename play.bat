@echo off
setlocal
cd /d "%~dp0"

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install || goto :fail
)

echo Building production bundle...
call npm run build || goto :fail

call :freeport 3000 || exit /b 1

start "" http://localhost:3000
call npm run start || goto :fail
goto :eof

:freeport
for /f "tokens=5" %%P in ('netstat -ano -p tcp ^| findstr /r /c:":%~1 .*LISTENING"') do (
    echo Port %~1 is in use by PID %%P.
    choice /c YN /m "Stop that process"
    if errorlevel 2 (
        echo Leaving it running. Start Next.js on another port with: npm run start -- -p 3001
        pause
        exit /b 1
    )
    taskkill /pid %%P /f /t >nul 2>&1
)
exit /b 0

:fail
echo.
echo Failed with error code %errorlevel%.
pause
exit /b %errorlevel%
