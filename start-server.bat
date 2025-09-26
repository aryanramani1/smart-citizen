@echo off
echo Starting SmartCitizen Local Server...
echo.
echo Choose your preferred method:
echo 1. Python HTTP Server (if Python installed)
echo 2. Node.js HTTP Server (if Node.js installed)  
echo 3. PHP Built-in Server (if PHP installed)
echo 4. Open directly in browser (basic mode)
echo.

set /p choice="Enter choice (1-4): "

if "%choice%"=="1" (
    echo Starting Python HTTP Server on http://localhost:8000
    python -m http.server 8000
) else if "%choice%"=="2" (
    echo Starting Node.js HTTP Server on http://localhost:8000
    npx http-server -p 8000
) else if "%choice%"=="3" (
    echo Starting PHP Built-in Server on http://localhost:8000
    php -S localhost:8000
) else (
    echo Opening SmartCitizen in default browser...
    start index.html
)

pause