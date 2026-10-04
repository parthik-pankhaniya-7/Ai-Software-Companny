# scripts/dev.ps1 - Development launcher for ai-dev-org on Windows
$ErrorActionPreference = "Stop"

# Ensure local persistence directories exist
New-Item -ItemType Directory -Force -Path "data\projects", "data\memory", "data\langgraph", "data\chroma", "logs" | Out-Null

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptRoot
Set-Location $projectRoot

Write-Host "Starting ai-dev-org multi-agent environment..." -ForegroundColor Cyan

# Launch backend FastAPI server
Write-Host "Launching FastAPI backend on http://0.0.0.0:8000..." -ForegroundColor Green
$backendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; if (Test-Path .venv\Scripts\Activate.ps1) { & .venv\Scripts\Activate.ps1 }; uvicorn app.main:app --reload --host 0.0.0.0 --port 8000" -PassThru

# Launch frontend Next.js dev server
Write-Host "Launching Next.js frontend on http://localhost:3000..." -ForegroundColor Green
$frontendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev" -PassThru

Write-Host "ai-dev-org processes started successfully." -ForegroundColor Cyan
Write-Host "Backend PID: $($backendProcess.Id) | Frontend PID: $($frontendProcess.Id)" -ForegroundColor Yellow
Write-Host "Press Ctrl+C or close the terminal windows to stop servers." -ForegroundColor Gray
