# 2026 Automation Pipeline: Lean Budget Plan
## From Tools to Pipeline - Scaling as a Solo Developer (10 hrs/week, <$100/month)

**Project Goal**: Automate the workflow from tournament footage to YouTube highlights on a lean budget, eliminating expensive AI services while maintaining automation.

**Budget Target**: ~$36/month | **Time Investment**: 10 hours/week | **Timeline**: 2-3 weeks (Days 1-21)

**Tech Stack Foundation**: React Native, Firebase, Expo, Next.js, Google Cloud Platform

---

## Cost Optimization Strategy

### Replacing Expensive Video Intelligence API
Instead of paying $0.10/minute for AI video analysis, we use **free alternatives**:

#### Option A: The "Marker" Method (Cost: $0) ⭐ Recommended
- **Setup**: Configure OBS hotkey (e.g., `Ctrl+M`) to write timestamps to a local file
- **Workflow**: Press hotkey during good shots → Watcher script reads markers → Only processes 30-second clips around markers
- **Cost**: $0 - No AI analysis needed
- **Logic**: Only pay to store and process the "Gold" (highlights), not the 10 hours of "Coal" (full stream)

#### Option B: Frame Differencing (Cost: $0) - Advanced
- **Technology**: OpenCV (free Python library) running locally
- **Logic**: Since billiard cameras are stationary, detect motion on the table
- **Workflow**: If no balls moving → ignore footage. If motion detected → flag segment for processing
- **Cost**: $0 - Runs on your PC, no cloud costs

### Storage Strategy: "Use and Burn"
- **Workflow**: Upload Raw Video → Generate Edit → Save Final Edit → **Delete Raw Video**
- **Automation**: GCS Lifecycle Policy auto-deletes files in `videos/` folder older than 5 days
- **Local Files**: OBS recordings remain in local folder (`/Users/davidv.onquit/Movies`) as backup
  - Local files are NOT auto-deleted (manual cleanup when needed)
  - Provides backup if GCS upload fails or file is needed locally
- **Safety Net**: Full stream archived on YouTube (free infinite archive)
- **Result**: Firebase/GCS is a temporary workbench, not permanent storage. Local files serve as backup archive.

---

## Week 1 (Days 1-7): Automatic Upload (The Watcher)
**Goal**: Get files to the cloud without clicking buttons.

### 1.1 OBS Setup
- **Configure OBS Recording**:
  - Set recording format to `.mkv` while streaming
  - Enable "Remux to MP4" auto-action (Settings → Advanced → Recording)
  - Set recording output folder to dedicated directory
  - **Optional**: Set up hotkey (Ctrl+M) to write timestamps to marker file

### 1.2 The Watcher Script (Single File)
- **File**: `index.js` - One file, paste and run
- **Setup**:
  1. Create folder: `C:\Scripts\BilliardUploader`
  2. Save `index.js` in that folder
  3. Run: `npm install firebase-admin @google-cloud/storage chokidar`
  4. Edit CONFIG section with your settings
  5. Run: `node index.js`
- **Functionality**:
  - Watches OBS recording folder
  - Detects when file is closed (OBS finished writing)
  - Uploads to GCS bucket
  - Creates Firestore document
  - **Optional**: Reads marker file for timestamp-based clipping

### 1.3 Firestore Entry Structure
```javascript
{
  videoId: "auto-generated-id",
  fileName: "tournament_2026_01_15.mp4",
  gcsPath: "gs://bucket-name/videos/tournament_2026_01_15.mp4",
  uploadedAt: Timestamp,
  status: "uploaded",
  markers: [123.5, 456.2, 789.8], // Optional: timestamps from OBS hotkey
  metadata: {
    fileSize: number,
    uploadedBy: "obs-watcher"
  }
}
```

### 1.4 Deliverables
- ✅ Single-file watcher script (`index.js`)
- ✅ GCS bucket with lifecycle policy (auto-delete after 2 days)
- ✅ Firestore collection structure
- ✅ Marker file support (optional)

---

## Week 2 (Days 8-14): TTS Integration
**Goal**: Automatically generate commentary for uploaded clips.

### 2.1 Cloud Function Trigger
- **Trigger**: Firestore document creation (when video is uploaded)
- **Function**: `onVideoUploaded`
- **Action**: Generate script and TTS audio

### 2.2 Script Generation (Gemini API)
- **Input**: Video metadata + markers (if available) OR manual summary
- **Model**: Gemini 1.5 Pro (free tier available, very affordable)
- **Prompt Template**:
  ```
  You are a professional billiard commentator. Based on these timestamps, write a high-energy 30-second summary script. Include:
  - Opening hook (5 seconds)
  - Key moments (20 seconds)
  - Closing statement (5 seconds)
  
  Timestamps: [from markers or manual input]
  ```
- **Cost**: < $1/month (under 1M characters = FREE tier)

### 2.3 TTS Generation
- **Trigger**: When `script_text` is added to Firestore
- **Function**: `onScriptGenerated`
- **Technology**: Google Cloud Text-to-Speech API
- **Output**: `.mp3` audio file stored in GCS
- **Cost**: FREE (under 1 million characters/month = free tier)
- **Voice**: Professional sports commentary voice

### 2.4 Deliverables
- ✅ Cloud Function for script generation (Gemini)
- ✅ Cloud Function for TTS generation
- ✅ Firestore document updates with script and audio paths

---

## Week 3 (Days 15-21): The Headless Editor
**Goal**: Cloud stitches clips together while you're at your full-time job.

### 3.1 Video Editor (Headless on Cloud Run)
- **Technology**: Docker container with FFmpeg
- **Deployment**: Google Cloud Run
- **Inputs**:
  - Raw billiard video (from GCS)
  - TTS audio file (from GCS)
  - Logo overlay (TourTrack branding)
  - Markers (if available) - extracts 30-second clips
- **Process**:
  1. Download video and audio from GCS
  2. Use FFmpeg to:
     - Extract clips around markers (if available) OR use full video
     - Sync TTS audio with video
     - Add logo overlay
     - Apply color correction/optimization
     - Export final MP4
  3. Upload finished video to GCS
  4. **Delete raw video** (lifecycle policy handles this)
- **Benefits**: 
  - Renders while you sleep/work
  - No laptop/phone needed
  - Scalable and cost-effective

### 3.2 Firestore Status Updates
- Track stages: `uploaded` → `scripted` → `processing` → `completed`
- Store GCS paths: final video only (raw deleted after processing)

### 3.3 Deliverables
- ✅ Cloud Run container with FFmpeg
- ✅ Video stitching logic with marker support
- ✅ Status tracking system
- ✅ GCS lifecycle policy for auto-cleanup

---

## Budget Breakdown (10 hours/week, ~40 hours/month)

| Item | Logic | Monthly Cost |
|------|-------|--------------|
| **Storage (GCS)** | 40 hours raw footage (temp) + finals | ~$8.00 |
| **Network (Egress)** | Moving files to Cloud Run for editing | ~$12.00 |
| **Cloud Run (Editing)** | Rendering 10 hours of highlights | ~$15.00 |
| **Gemini API** | Summarizing match data for scripts | < $1.00 |
| **TTS API** | Under 1 million characters | **FREE** |
| **Video Intelligence** | Not used (replaced with markers/OpenCV) | **$0.00** |
| **TOTAL** | | **~$36.00/mo** |

### Cost Savings vs Original Plan
- **Original**: ~$180/month (with Video Intelligence)
- **New Plan**: ~$36/month
- **Savings**: ~80% reduction

### Free Tier Benefits
- **Firebase**: Generous free tier for Firestore, Functions
- **GCS**: 5GB storage, 1GB egress/month free
- **Cloud Run**: 2 million requests/month free
- **Gemini API**: Free tier (under 1M characters)
- **TTS API**: Free tier (under 1M characters/month)

---

## Technical Architecture Summary

### Database/Auth
- **Firebase Firestore**: Video metadata, scripts, status tracking
- **Firebase Auth**: Optional for admin panel

### Logic/Bridge
- **Cloud Functions (Node.js)**: 
  - `onVideoUploaded` - Triggers script generation
  - `onScriptGenerated` - Triggers TTS
- **Local Watcher Script**: Single-file OBS → GCS bridge (`index.js`)

### Intelligence (Budget-Optimized)
- **Gemini 1.5 Pro**: Script generation only (< $1/month)
- **Marker Method**: Free timestamp-based clipping (OBS hotkey)
- **OpenCV (Optional)**: Free local motion detection

### Media Engine
- **FFmpeg on Cloud Run**: Video processing, audio sync, rendering
- **Google Cloud TTS**: Audio generation (FREE tier)

### Storage
- **Google Cloud Storage**: 
  - Raw videos (temp, auto-deleted after 2 days)
  - Final videos (permanent)
  - Audio files
- **Lifecycle Policy**: Auto-delete raw videos to save costs

### Frontend
- **Next.js (Portfolio)**: Public-facing project showcase (optional)

---

## Immediate Next Steps (Days 1-7)

1. **Day 1-2: Set up OBS Watcher Script**
   - Copy `index.js` to `C:\Scripts\BilliardUploader`
   - Install: `npm install firebase-admin @google-cloud/storage chokidar`
   - Edit CONFIG section with your settings
   - Test with sample recording

2. **Day 2-3: Create GCS Bucket**
   - Set up bucket with proper permissions
   - **Configure lifecycle policy**: Auto-delete files in `uploads/` folder after 2 days
   - Keep `finals/` folder permanent

3. **Day 3-4: Set up Firestore Structure**
   - Create `videos` collection (auto-created by script)
   - Define security rules
   - No indexes needed initially

4. **Day 4-5: Optional - Set up Marker Method**
   - Configure OBS hotkey (Ctrl+M) to write to marker file
   - Update `MARKER_FILE` path in `index.js`
   - Test marker reading

5. **Day 5-7: Test End-to-End Flow**
   - Record test video in OBS
   - Verify upload to GCS
   - Verify Firestore document creation
   - Verify raw video deletion after 2 days

---

## Success Metrics

- **Time Saved**: Reduce manual workflow from 2-3 hours to < 5 minutes
- **Cost**: Stay under $40/month
- **Throughput**: Process 10+ highlight videos per week automatically
- **Quality**: Consistent professional output
- **Automation**: Zero manual intervention after setup

---

## Future Enhancements (Post-Day 21)

- **YouTube Auto-Upload**: Cloud Function to publish finished videos
- **Portfolio Integration**: Auto-update tkamot.com/projects
- **Multi-language Support**: Generate scripts in multiple languages
- **Analytics Dashboard**: Track video performance, views, engagement
- **OpenCV Integration**: Advanced motion detection for automatic clipping

---

**Last Updated**: January 2026
**Status**: Ready for Day 1 Implementation
**Budget**: ~$36/month | **Timeline**: 2-3 weeks (Days 1-21) | **Focus**: 10 hrs/week

