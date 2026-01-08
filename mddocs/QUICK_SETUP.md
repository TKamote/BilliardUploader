# 🎯 Quick Hotkey Setup - F8 for Markers

## What We're Setting Up

Press **F8** anytime during recording to mark a highlight moment. The timestamp gets saved automatically!

---

## ⚡ Fast Setup (3 Steps)

### 1️⃣ Create Automator Quick Action

**Open Automator** → Choose **"Quick Action"** → Configure:

- **Workflow receives:** no input
- **in:** any application

**Add Action:** Drag "Run Shell Script" → Use this code:
```bash
curl -X POST http://localhost:3000/marker 2>/dev/null
```

**Save as:** "Save Marker"

### 2️⃣ Assign F8 Key

**System Settings** → **Keyboard** → **Keyboard Shortcuts** → **Services**

Find **"Save Marker"** → Click empty space → Press **F8**

### 3️⃣ Test It!

1. Start marker server: `npm run marker-server`
2. Start recording in OBS
3. Press **F8** during recording
4. Check terminal: Should see `✅ Marker saved: XX.XXs`

---

## 🎮 Using F1 Key

**Why F1?**
- ✅ First key, easy to find and press
- ✅ Single key press (no modifiers needed)
- ✅ Top-left corner, natural position
- ✅ Perfect for quick highlights!

**Note:** On macOS, F1 usually controls screen brightness by default. You have two options:

1. **Enable standard function keys** (recommended):
   - System Settings → Keyboard → Use F1, F2, etc. as standard function keys
   - Then F1 will work as a hotkey
   - Use Control+F1 for brightness instead

2. **Use Fn+F1**:
   - Keep brightness control on F1
   - Use Fn+F1 as your marker hotkey
   - Requires two-key press but keeps system controls

**Other options if F1 doesn't work:**
- F2, F3, F8, F9, F10
- Option+M (modifier key combo)

---

## 📋 Complete Workflow

1. **Start marker server** (Terminal 1):
   ```bash
   npm run marker-server
   ```

2. **Start watcher** (Terminal 2):
   ```bash
   npm start
   ```

3. **Start recording in OBS**

4. **Press F1** whenever you see a highlight! 🎯

5. **Stop recording** → Watcher automatically uploads with markers

---

## ✅ Verification

**Check if it's working:**
```bash
# Test marker server
curl http://localhost:3000/status

# Manually trigger marker
curl -X POST http://localhost:3000/marker

# View saved markers
cat markers.txt
```

---

## 🐛 Troubleshooting

**F1 doesn't work?**
- Make sure you enabled "Use F1, F2, etc. as standard function keys" OR use Fn+F1
- Make sure Automator workflow is saved
- Check System Settings → Keyboard → Shortcuts → Services
- Verify "Save Marker" is enabled and F1 (or Fn+F1) is assigned
- Try F2, F8, F9, or F10 instead

**No marker saved?**
- Marker server must be running
- Must be recording in OBS when pressing F8
- Check terminal for connection errors

---

**That's it!** Press F8 during highlights and the timestamps will be saved automatically! 🎉

