#!/bin/bash

echo "Starting Resonance Full-Stack App..."

# 1. Start Backend in the background
echo "[Backend] Starting FastAPI server on port 8000..."
cd backend
source venv/bin/activate
uvicorn server:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

# Wait a moment for the backend to boot up
sleep 2

# 2. Start Frontend in the background
echo "[Frontend] Starting React development server on port 3000..."
cd frontend
yarn start &
FRONTEND_PID=$!
cd ..

echo "=========================================================="
echo "🚀 Both servers are now running!"
echo "📡 Backend API: http://localhost:8000"
echo "💻 Frontend UI: http://localhost:3000"
echo "🛑 Press Ctrl+C to stop both servers."
echo "=========================================================="

# 3. Trap SIGINT (Ctrl+C) to gracefully stop both servers
trap "echo -e '\nStopping servers...'; kill $BACKEND_PID $FRONTEND_PID; exit" EXIT

# Wait indefinitely so the script doesn't exit immediately
wait $BACKEND_PID $FRONTEND_PID
