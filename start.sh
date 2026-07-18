#!/bin/bash

echo "Starting Resonance Full-Stack App..."

# 0. Start Database using Docker
echo "[Database] Ensuring MongoDB is running via Docker..."
if ! docker ps -q -f name=resonance_mongo | grep -q .; then
    if docker ps -aq -f status=exited -f name=resonance_mongo | grep -q .; then
        echo "[Database] Restarting existing MongoDB container..."
        docker start resonance_mongo
    else
        echo "[Database] Downloading MongoDB image (this takes a minute)..."
        docker pull mongo:4.4
        echo "[Database] Creating and starting new MongoDB container..."
        docker run -d -p 127.0.0.1:27017:27017 --name resonance_mongo mongo:4.4
    fi
    echo "[Database] Waiting for database to initialize..."
    sleep 5 # Wait for MongoDB to fully spin up
else
    echo "[Database] MongoDB is already running via Docker."
fi

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
