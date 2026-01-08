# Day 2: GCS Bucket & Firestore Setup Guide
## Step-by-Step Instructions

**Goal**: Create Google Cloud Storage bucket and configure Firestore so the watcher script can upload videos.

**Time Estimate**: 30-45 minutes  
**Prerequisites**: Day 1 complete, Google Cloud Console access, Firebase project access

---

## 📝 Important Notes

**Project Configuration:**
- ✅ We'll create the GCS bucket in your existing project (`videoeditor-2508b`)
- ✅ No new project or account needed - buckets are created within existing projects
- ✅ Buckets don't count toward project limits
- ✅ Using existing Firebase/Google Cloud project saves setup time

**Bucket Details:**
- **Bucket Name**: `obs-pipeline-videos`
- **Region**: `us-central1` (Iowa)
- **Purpose**: Store uploaded OBS recordings temporarily (auto-delete after 2 days)

---

## ✅ Step 1: Create GCS Bucket (5-10 minutes)

### 1.1 Navigate to Cloud Storage
1. Go to: https://console.cloud.google.com/storage
2. **Verify project**: Make sure `videoeditor-2508b` is selected (top dropdown)
3. You should see the "Buckets" page with a "Create" button

### 1.2 Create Bucket
1. Click **"Create"** button
2. Configure the bucket:

   **Name your bucket:**
   - Name: `obs-pipeline-videos`
   - ⚠️ Bucket names must be globally unique (if taken, add numbers/suffix)

   **Choose where to store your data:**
   - Location type: **Region**
   - Region: **us-central1 (Iowa)**
   - (This region is cost-effective and has good performance)

   **Choose a storage class for your data:**
   - Default storage class: **Standard**

   **Choose how to control access to objects:**
   - Access control: **Uniform** (bucket-level permissions)

   **Choose how to protect object data:**
   - Public access: **Prevent public access** ✅
   - Encryption: **Google-managed key** (default)

3. Click **"Create"**

**Verify**: You should see `obs-pipeline-videos` in your buckets list.

---

## ✅ Step 2: Configure Lifecycle Policy (5 minutes)

### 2.1 Open Bucket Settings
1. Click on the bucket name: `obs-pipeline-videos`
2. Go to the **"Lifecycle"** tab (left sidebar)

### 2.2 Create Lifecycle Rule
1. Click **"Add a rule"**
2. Configure the rule:

   **Rule name:**
   - Name: `auto-delete-raw-videos`

   **Action:**
   - Select: **Delete object**

   **Condition:**
   - Age: **≥ 2 days**
   - Object name prefix: `videos/` (only delete files in videos/ folder)

3. Click **"Create"**

**What this does:**
- Files uploaded to `videos/` folder will be automatically deleted after 2 days
- This implements the "Use and Burn" strategy to save costs
- Final processed videos (in `finals/` folder) won't be affected

---

## ✅ Step 3: Update Script & Test (10 minutes)

### 3.1 Update Script Configuration
1. Open `~/Scripts/BilliardUploader/index.js` in your editor
2. Find the CONFIG section (around line 30)
3. Update the bucket name:

   ```javascript
   const CONFIG = {
     OBS_FOLDER: '/Users/davidv.onquit/Movies',
     PROJECT_ID: 'videoeditor-2508b',
     BUCKET_NAME: 'obs-pipeline-videos', // ✅ Updated!
     SERVICE_ACCOUNT_PATH: './service-account-key.json',
     // ... rest of config
   };
   ```

4. Save the file

### 3.2 Verify Firestore is Enabled
1. Go to: https://console.firebase.google.com/
2. Select project: `videoeditor-2508b`
3. Check if **Firestore Database** is enabled:
   - If you see "Firestore Database" in the left menu → ✅ Already enabled
   - If not, click "Firestore Database" → "Create database" → Choose "Start in production mode" → Select region → Create

**Note**: Firestore will automatically create the `videos` collection when the script creates the first document.

### 3.3 Test End-to-End
1. **Start the watcher script:**
   ```bash
   cd ~/Scripts/BilliardUploader
   node index.js
   ```

2. **Record a test video:**
   - Open OBS Studio
   - Record a short video (10-20 seconds)
   - Stop the recording

3. **Watch the terminal:**
   You should see:
   ```
   📹 New file detected: test_video.mp4
   ⏳ Waiting for file to stabilize...
   ☁️  Uploading to Google Cloud Storage...
   ✅ Upload complete: gs://obs-pipeline-videos/videos/test_video.mp4
   📝 Creating Firestore document...
   ✅ Firestore document created: [videoId]
   🎉 Successfully processed: test_video.mp4
   ```

4. **Verify in GCS:**
   - Go to: https://console.cloud.google.com/storage/browser/obs-pipeline-videos
   - You should see a `videos/` folder
   - Your test video should be inside

5. **Verify in Firestore:**
   - Go to: https://console.firebase.google.com/project/videoeditor-2508b/firestore
   - Click on `videos` collection
   - You should see a new document with your video metadata

---

## 🎯 Day 2 Completion Checklist

- [ ] GCS bucket `obs-pipeline-videos` created
- [ ] Lifecycle policy configured (auto-delete after 2 days)
- [ ] Script updated with bucket name
- [ ] Firestore enabled (or verified)
- [ ] Test video uploaded successfully
- [ ] File visible in GCS bucket
- [ ] Firestore document created

---

## 🚀 What's Next?

**Day 3-4**: Optional marker method setup (OBS hotkey for timestamp markers)

**Day 5-7**: Testing & refinement - ensure everything works smoothly

**Week 2 (Days 8-14)**: TTS Integration - automatic script and audio generation

---

## 💡 Pro Tips

1. **Test with small files first**: Use short recordings to avoid long upload times during testing
2. **Monitor costs**: Check Google Cloud billing to ensure you're within free tier limits
3. **Keep script running**: Once Day 2 is complete, you can leave the watcher running in the background

---

## ❓ Troubleshooting

**"Bucket creation failed - name already taken"**
- Bucket names must be globally unique
- Try: `obs-pipeline-videos-[yourname]` or `obs-pipeline-videos-2026`

**"Upload failed - permission denied"**
- Verify service account has "Storage Object Admin" role
- Check bucket name matches exactly in CONFIG

**"Firestore document not created"**
- Verify Firestore is enabled in Firebase Console
- Check service account has "Cloud Datastore User" role

**Status**: Day 2 Complete! ✅ Ready for Day 3-4: Optional Marker Method Setup

