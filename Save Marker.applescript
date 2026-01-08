-- Save Marker AppleScript
-- This can be used with Automator or assigned directly as a keyboard shortcut
-- Calls the marker server to save current recording timestamp

do shell script "curl -X POST http://localhost:3000/marker 2>/dev/null"

