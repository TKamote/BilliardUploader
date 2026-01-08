#!/bin/bash
# Save Marker Script
# Triggers marker save via HTTP request to marker server
# Can be triggered by hotkey apps (Automator, Keyboard Maestro, etc.)

# Call the marker server endpoint
RESPONSE=$(curl -s -X POST http://localhost:3000/marker 2>/dev/null)

# Optional: Show notification (uncomment if you want visual feedback)
# osascript -e "display notification \"Marker saved!\" with title \"OBS Marker\"" 2>/dev/null

# Exit with success
exit 0

