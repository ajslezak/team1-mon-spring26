#!/bin/bash

# Function to safely shut down both servers
cleanup() {
    echo -e "\n[Shutdown] Stopping servers..."
    kill $DJANGO_PID $UVICORN_PID 2>/dev/null
    wait $DJANGO_PID $UVICORN_PID 2>/dev/null
    echo "[Shutdown] Both servers stopped."
    exit 0
}

# Catch Ctrl+C (SIGINT) and terminal kill (SIGTERM)
trap cleanup SIGINT SIGTERM

# Auto-activate virtual environment if it exists
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
fi

# Force load .env variables to override stale terminal exports
if [ -f ".env" ]; then
    set -a
    source .env
    set +a
fi

if [ -f ".env.local" ]; then
    set -a
    source .env.local
    set +a
fi

echo "[Startup] Starting Django WSGI server..."
if [[ -s `which python` ]]; then
    PYTHON_CMD="python"
else
    PYTHON_CMD="python3"
fi
$PYTHON_CMD manage.py runserver &
DJANGO_PID=$!

sleep 2

echo "[Startup] Starting Starlette ASGI server (Uvicorn)..."
uvicorn django_map.asgi:application --port 8001 --reload &
UVICORN_PID=$!

echo -e "\n[Running] Both servers are running. Press Ctrl+C to stop."

# Wait indefinitely until interrupted
wait $DJANGO_PID $UVICORN_PID
