#!/bin/bash
# Quick test script for marker server

echo "Testing marker server..."
echo ""

# Check if server is running
STATUS=$(curl -s http://localhost:3000/status 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✅ Marker server is running"
    echo "Status: $STATUS"
    echo ""
    echo "Triggering marker..."
    RESPONSE=$(curl -s -X POST http://localhost:3000/marker)
    echo "Response: $RESPONSE"
    echo ""
    echo "Check markers.txt for the timestamp:"
    cat markers.txt 2>/dev/null || echo "(file is empty or doesn't exist yet)"
else
    echo "❌ Marker server is not running"
    echo "Start it with: npm run marker-server"
fi

