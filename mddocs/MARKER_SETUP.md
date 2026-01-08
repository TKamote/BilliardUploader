# Automated Marker System Setup Guide

## Overview

This automated marker system uses OBS WebSocket to get the current recording time when you press a hotkey, then writes it to the marker file.

## Prerequisites

1. **OBS WebSocket Plugin** - Must be installed
2. **Node.js** - Already installed
3. **Hotkey App** - For triggering markers (macOS: Keyboard Maestro, BetterTouchTool, or Automator)

---

## Step 1: Install OBS WebSocket Plugin

1. **Download OBS WebSocket:**
   - Go to: https://github.com/obsproject/obs-websocket/releases
   - Download the latest release for macOS
   - Or install via Homebrew: `brew install obs-websocket`

2. **Install the plugin:**
   - Extract the downloaded file
   - Copy to: `~/Library/Application Support/obs-studio/plugins/`
   - Restart OBS

3. **Enable WebSocket in OBS:**
   - OBS → Tools → WebSocket Server Settings
   - Check "Enable WebSocket server"
   - Port: `4455` (default)
   - Password: Leave empty (or set one if you want)
   - Click "OK"

---

## Step 2: Install Dependencies

```bash
cd ~/Scripts/BilliardUploader
npm install obs-websocket-js
```

---

## Step 3: Start the Marker Server

```bash
cd ~/Scripts/BilliardUploader
node obs-marker-server.js
```

You should see:
```
✅ Connected to OBS WebSocket
✅ HTTP server running on http://localhost:3000
✅ Marker server ready!
```

**Keep this running** while you stream/record.

---

## Step 4: Set Up Hotkey

### Option A: Using Keyboard Maestro (Recommended for macOS)

1. **Install Keyboard Maestro** (if not installed)
   - https://www.keyboardmaestro.com/

2. **Create new macro:**
   - Trigger: Your chosen hotkey (e.g., `Ctrl+M` or `F8`)
   - Action: Execute Shell Script
   - Script: `curl -X POST http://localhost:3000/marker`

### Option B: Using BetterTouchTool

1. **Install BetterTouchTool** (if not installed)
   - https://folivora.ai/

2. **Create new gesture/hotkey:**
   - Trigger: Your chosen hotkey
   - Action: Execute Shell Script
   - Script: `curl -X POST http://localhost:3000/marker`

### Option C: Using macOS Automator

1. **Create new Quick Action:**
   - Open Automator
   - Choose "Quick Action"
   - Add "Run Shell Script" action
   - Script: `curl -X POST http://localhost:3000/marker`
   - Save as "Save Marker"

2. **Assign keyboard shortcut:**
   - System Settings → Keyboard → Shortcuts → Services
   - Find "Save Marker"
   - Assign your hotkey

### Option D: Simple Shell Script (Manual)

1. **Make script executable:**
   ```bash
   chmod +x ~/Scripts/BilliardUploader/save-marker.sh
   ```

2. **Use with any hotkey app:**
   - Trigger: Your hotkey
   - Action: Run script: `~/Scripts/BilliardUploader/save-marker.sh`

---

## Step 5: Test It

1. **Start the marker server:**
   ```bash
   node obs-marker-server.js
   ```

2. **Start recording in OBS**

3. **Press your hotkey** during recording

4. **Check the terminal:**
   - Should see: `✅ Marker saved: XX.XXs`

5. **Check marker file:**
   ```bash
   cat markers.txt
   ```
   - Should see timestamps

6. **Stop recording** and let the watcher script process it
   - Markers should appear in Firestore document

---

## How It Works

1. **Marker server connects to OBS** via WebSocket
2. **You press hotkey** → Triggers HTTP request to `http://localhost:3000/marker`
3. **Server gets current recording time** from OBS
4. **Writes timestamp** to `markers.txt`
5. **Watcher script reads markers** when processing video
6. **Markers saved in Firestore** for later processing

---

## Troubleshooting

**"Failed to connect to OBS WebSocket"**
- Make sure OBS WebSocket plugin is installed
- Check WebSocket is enabled in OBS (Tools → WebSocket Server Settings)
- Verify port is 4455 (default)

**"Not recording" message**
- Start recording in OBS first
- Marker server only works during active recording

**Hotkey doesn't work**
- Make sure marker server is running
- Test manually: `curl -X POST http://localhost:3000/marker`
- Check hotkey app is configured correctly

**Markers not appearing in Firestore**
- Make sure watcher script is running
- Check marker file has content: `cat markers.txt`
- Verify MARKER_FILE path in watcher script config

---

## Usage Tips

- **Start marker server before recording** - Keep it running
- **Press hotkey during important moments** - After break, after last ball, etc.
- **Markers are cleared** when new recording starts (automatic)
- **Multiple markers per video** - Press hotkey multiple times

---

## Next Steps

Once markers are working:
- Week 3 will use these markers to extract highlight clips
- Only process 30-second clips around each marker
- Save processing time and costs

