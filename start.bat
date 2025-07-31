@echo off
echo Starting Cassitydev Discord Bot...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if dependencies are installed
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Create sandbox directory if it doesn't exist
if not exist "sandbox" (
    mkdir sandbox
    echo Created sandbox directory
)

REM Check if .env file exists
if not exist ".env" (
    echo ERROR: .env file not found
    echo Please create a .env file with your Discord bot token and other required variables
    echo Example:
    echo DISCORD_TOKEN=your_discord_token_here
    echo GROQ_API_KEY=your_groq_api_key_here
    echo.
    pause
    exit /b 1
)

echo Starting bot...
node index.js

pause
