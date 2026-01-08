# Day 3: Testing, Refinement & Optional Marker Method Setup
## Step-by-Step Instructions

**Goal**: Test the complete pipeline, refine settings, and optionally set up marker method for timestamp-based clipping.

**Time Estimate**: 1-2 hours  
**Prerequisites**: Day 1 & Day 2 complete, OBS configured, script running

---

## 📝 Overview

Day 3 has two paths:
1. **Testing & Refinement** (Required) - Ensure everything works smoothly
2. **Marker Method Setup** (Optional) - Set up OBS hotkey for timestamp markers

You can do both or just the testing. The marker method is useful if you want to automatically extract highlight clips later.

---

## Part A: Testing & Refinement (30-45 minutes)

### ✅ Step 1: Test with Real Recording (15 minutes)

1. **Start the watcher script:**
   ```bash
   cd ~/Scripts/BilliardUploader
   node index.js
   ```

2. **Record a real session:**
   - Start streaming in OBS (if you stream)
   - Record for 5-10 minutes
   - Stop recording

3. **Monitor the terminal:**
   - Watch for file detection
   - Verify upload progress
   - Check for any errors

4. **Verify in GCS:**
   - Go to: https://console.cloud.google.com/storage/browser/obs-pipeline-videos/videos
   - Confirm file appears
   - Check file size and details

5. **Verify in Firestore:**
   - Go to: https://console.firebase.google.com/project/videoeditor-2508b/firestore
   - Open `videos` collection
   - Check document has all fields:
     - `videoId`
     - `fileName`
     - `gcsPath`
     - `uploadedAt`
     - `status: "uploaded"`
     - `metadata.fileSize`

### ✅ Step 2: Test Multiple Files (10 minutes)

1. **Record 2-3 short test videos** (30 seconds each)
2. **Verify each uploads successfully**
3. **Check Firestore** - should see multiple documents
4. **Check GCS** - should see multiple files in `videos/` folder

### ✅ Step 3: Performance Check (10 minutes)

1. **Monitor CPU usage:**
   - Open Activity Monitor
   - Check CPU usage while streaming + recording
   - Verify hardware encoding is working (low CPU)

2. **Check for lag:**
   - Stream + record for 15-20 minutes
   - Monitor for any performance issues
   - Adjust OBS settings if needed

3. **Verify script stability:**
   - Leave script running
   - Record multiple files over time
   - Ensure script doesn't crash or hang

### ✅ Step 4: Troubleshooting (if needed)

**Common issues:**

- **Upload fails:**
  - Check service account permissions
  - Verify bucket name in CONFIG
  - Check network connection

- **File not detected:**
  - Verify OBS folder path is correct
  - Check file extension matches (`.mp4`, `.mkv`)
  - Ensure file is over 10MB (MIN_FILE_SIZE_MB)

- **Script crashes:**
  - Check terminal for error messages
  - Verify all dependencies installed
  - Check service account key exists

---

## Part B: Optional Marker Method Setup (30-45 minutes)

### What is the Marker Method?

Instead of using expensive AI to find highlights, you press a hotkey (e.g., `Ctrl+M`) during good shots. OBS writes timestamps to a file, and the script reads those markers to extract only the highlight moments.

**Benefits:**
- ✅ FREE (no AI costs)
- ✅ Precise (you mark the exact moments)
- ✅ Fast (no video analysis needed)

**Use Case:**
- Mark good shots during live stream/recording
- Script extracts 30-second clips around each marker
- Only process highlights, not entire 2-hour stream

---

### ✅ Step 1: Create Marker File (2 minutes)

1. **Create marker file:**
   ```bash
   cd ~/Scripts/BilliardUploader
   touch markers.txt
   ```

2. **Verify it exists:**
   ```bash
   ls -la markers.txt
   ```

### ✅ Step 2: Set Up OBS Hotkey Script (20 minutes)

OBS doesn't have built-in marker functionality, so we need a simple script.

**Option A: Simple OBS Script (Recommended)**

1. **Create OBS script file:**
   - Create: `~/Scripts/BilliardUploader/obs-marker.lua`
   - This will be an OBS Lua script

2. **Script content:**
   ```lua
   -- OBS Marker Script
   -- Saves current recording timestamp to markers.txt
   
   obs = obslua
   
   function script_description()
       return "Save marker timestamps to file"
   end
   
   function script_properties()
       local props = obs.obs_properties_create()
       obs.obs_properties_add_path(props, "marker_file", "Marker File Path", obs.OBS_PATH_FILE, "Text files (*.txt)", nil)
       return props
   end
   
   function script_update(settings)
       marker_file = obs.obs_data_get_string(settings, "marker_file")
   end
   
   function script_defaults(settings)
       obs.obs_data_set_default_string(settings, "marker_file", os.getenv("HOME") .. "/Scripts/BilliardUploader/markers.txt")
   end
   
   function on_hotkey()
       if marker_file then
           local file = io.open(marker_file, "a")
           if file then
               local output = obs.obs_output_create("ffmpeg_output", "marker", nil, nil)
               if output then
                   local time = obs.obs_output_get_time(output)
                   file:write(string.format("%.2f\n", time / 1000000000)) -- Convert to seconds
                   file:close()
                   obs.obs_output_release(output)
               end
           end
       end
   end
   
   function script_load(settings)
       hotkey_id = obs.obs_hotkey_register_frontend("marker_hotkey", "Save Marker", on_hotkey)
       local hotkey_save_array = obs.obs_data_get_array(settings, "marker_hotkey")
       obs.obs_hotkey_load(hotkey_id, hotkey_save_array)
       obs.obs_data_array_release(hotkey_save_array)
   end
   ```

**Note:** OBS Lua scripting for recording timestamps is complex. A simpler alternative is below.

**Option B: External Script (Simpler)**

1. **Create a simple script that writes to marker file:**
   ```bash
   # Create: ~/Scripts/BilliardUploader/save-marker.sh
   echo $(date +%s) >> ~/Scripts/BilliardUploader/markers.txt
   ```

2. **Make it executable:**
   ```bash
   chmod +x ~/Scripts/BilliardUploader/save-marker.sh
   ```

3. **Set up OBS hotkey:**
   - OBS Settings → Hotkeys
   - Find "Scripts" → "Save Marker" (if using Lua script)
   - Or use macOS Automator to run the shell script on hotkey

**Option C: Manual Marker File (Easiest for now)**

For Day 3, you can manually test by:
1. Recording a video
2. Manually adding timestamps to `markers.txt`:
   ```
   30.5
   125.2
   300.8
   ```
3. Script will read these when processing the video

### ✅ Step 3: Update Script Configuration (5 minutes)

1. **Open `index.js`**
2. **Update CONFIG:**
   ```javascript
   const CONFIG = {
     // ... other settings
     MARKER_FILE: '/Users/davidv.onquit/Scripts/BilliardUploader/markers.txt', // ✅ Updated!
     // ... rest of config
   };
   ```

3. **Save the file**

### ✅ Step 4: Test Marker Reading (10 minutes)

1. **Create test markers:**
   ```bash
   cd ~/Scripts/BilliardUploader
   echo "30.5" > markers.txt
   echo "125.2" >> markers.txt
   ```

2. **Record a test video** (2-3 minutes)

3. **Watch terminal:**
   - Should see: `📍 Found 2 marker(s): 30.5, 125.2`
   - Markers will be saved in Firestore document

4. **Check Firestore:**
   - Open the video document
   - Should see `markers: [30.5, 125.2]` field
   - Should see `hasMarkers: true`

---

## 🎯 Day 3 Completion Checklist

**Required (Part A):**
- [ ] Tested with real recording
- [ ] Verified upload to GCS
- [ ] Verified Firestore document creation
- [ ] Tested multiple files
- [ ] Checked performance (CPU, lag)
- [ ] Script runs stable

**Optional (Part B):**
- [ ] Marker file created
- [ ] OBS hotkey configured (or manual method)
- [ ] Script updated with MARKER_FILE path
- [ ] Tested marker reading
- [ ] Verified markers in Firestore

---

## 🚀 What's Next?

**Day 4-5**: Continue marker method setup (if not done) or move to Week 2 prep

**Week 2 (Days 8-14)**: TTS Integration
- Cloud Functions for script generation
- Gemini API integration
- Google Cloud TTS

---

## 💡 Pro Tips

1. **Test with small files first** - Faster uploads during testing
2. **Monitor GCS costs** - Check billing to ensure within free tier
3. **Keep script running** - It will process files automatically
4. **Marker method is optional** - You can add it later if needed

---

**Status**: Day 3 Complete! ✅ Ready for Week 2: TTS Integration

