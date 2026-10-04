#!/usr/bin/env bash
set -e
mkdir -p data/projects data/memory data/langgraph data/chroma logs
cd backend && source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACK_PID=$!
cd ../frontend && npm run dev &
FRONT_PID=$!
trap "kill $BACK_PID $FRONT_PID" EXIT
wait
