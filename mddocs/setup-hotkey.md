# Hotkey Setup Instructions

## Recommended Hotkey: **F8**

F8 is a great choice because:
- ✅ Easy to press quickly during gameplay
- ✅ Doesn't conflict with common shortcuts
- ✅ Single key press (no modifier needed)
- ✅ Works in any application

---

## Setup Steps (5 minutes)

### Step 1: Create Automator Quick Action

1. **Open Automator**
   - Press `Cmd+Space` (Spotlight)
   - Type "Automator" and press Enter
   - Or: Applications → Automator

2. **Create New Document**
   - Choose "Quick Action" (or "Service" in older macOS)
   - Click "Choose"

3. **Configure the Workflow**
   - At the top, set:
     - "Workflow receives": **no input**
     - "in": **any application**
   
4. **Add Shell Script Action**
   - In the left sidebar, search for "Run Shell Script"
   - Drag it into the workflow area
   - Set "Shell" to: **/bin/zsh** (or /bin/bash)
   - Replace the default script with:
     ```bash
     curl -X POST http://localhost:3000/marker 2>/dev/null
     ```
   - ✅ Check "Ignore this action's input"

5. **Save the Workflow**
   - File → Save (or `Cmd+S`)
   - Name it: **Save Marker**
   - Save location: Default (will save to Services)

### Step 2: Assign Keyboard Shortcut

1. **Open System Settings**
   - Apple Menu → System Settings
   - Or: System Preferences (older macOS)

2. **Go to Keyboard Shortcuts**
   - Click "Keyboard" → "Keyboard Shortcuts"
   - Or: Keyboard → Shortcuts tab

3. **Find Your Service**
   - Click "Services" in the left sidebar
   - Scroll down to find "Save Marker"
   - (It's under "General" or "Text" section)

4. **Assign F8 Key**
   - Click the empty space next to "Save Marker"
   - Press **F8** key
   - The shortcut should appear

### Step 3: Test It!

1. **Make sure marker server is running:**
   ```bash
   npm run marker-server
   ```

2. **Start recording in OBS**

3. **Press F8** during recording

4. **Check terminal** - should see: `✅ Marker saved: XX.XXs`

5. **Check markers file:**
   ```bash
   cat markers.txt
   ```

---

## Troubleshooting

**Hotkey doesn't work:**
- Make sure marker server is running (`npm run marker-server`)
- Check System Settings → Keyboard → Shortcuts → Services → "Save Marker" is enabled
- Try a different key (F9, F10) if F8 conflicts

**"Service not found" in System Settings:**
- Make sure you saved the Automator workflow
- Restart System Settings
- Check: `~/Library/Services/` folder for "Save Marker.workflow"

**Marker not saving:**
- Verify marker server is connected to OBS (should see "✅ Connected to OBS WebSocket")
- Make sure you're recording in OBS when pressing the hotkey
- Check terminal for error messages

---

## Alternative: Use Function Key Lock

If F8 doesn't work (some keyboards require Fn key):
- Use **Fn+F8** as the shortcut
- Or enable "Use F1, F2, etc. keys as standard function keys" in System Settings → Keyboard

---

## Quick Test Command

Test the marker server manually:
```bash
curl -X POST http://localhost:3000/marker
```

Check status:
```bash
curl http://localhost:3000/status
```

