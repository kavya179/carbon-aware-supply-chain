@echo off
echo ========================================================
echo Starting Carbon-Aware Supply Chain Dashboard Services...
echo ========================================================

REM 1. Start Django Service (Port 8000)
start "1. Django Service (Port 8000)" cmd /k "cd django_service && python manage.py runserver 127.0.0.1:8000"

REM 2. Start Node.js API Gateway (Port 5000)
start "2. Node.js Express Gateway (Port 5000)" cmd /k "cd backend && npm start"

REM 3. Start React Frontend (Port 5173)
start "3. React Frontend (Port 5173)" cmd /k "cd frontend && npm run dev"

timeout /t 3 /nobreak >nul
start http://localhost:5173
echo All services launched!
