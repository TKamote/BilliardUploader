#!/bin/bash
# Start both watcher and marker server together

cd "$(dirname "$0")"

echo "🚀 Starting OBS Watcher and Marker Server..."
echo ""

# Start marker server in background
echo "📍 Starting marker server..."
npm run marker-server &
MARKER_PID=$!

# Wait a moment for marker server to start
sleep 2

# Start watcher in foreground
echo "👀 Starting file watcher..."
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down..."
    kill $MARKER_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Run watcher in foreground
npm start

# If watcher exits, cleanup
cleanup

