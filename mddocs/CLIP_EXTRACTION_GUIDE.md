# Clip Extraction Guide

## Overview

This script automatically extracts highlight clips from your recorded videos based on the marker timestamps you created during recording.

**How it works:**
1. Finds videos in Firestore that have markers but haven't been processed yet
2. Downloads the video from GCS
3. Extracts 30-second clips around each marker (15s before + 15s after)
4. Uploads clips back to GCS in `clips/{videoId}/` folder
5. Updates Firestore with clip information

---

## Prerequisites

### Step 1: Install FFmpeg

FFmpeg is required for video processing. Install it using Homebrew:

```bash
brew install ffmpeg
```

Verify installation:
```bash
ffmpeg -version
```

---

## Usage

### Option 1: Process Next Video with Markers (Automatic)

This will find and process the next video that has markers but hasn't been processed yet:

```bash
npm run extract-clips
```

### Option 2: Process Specific Video

Process a specific video by providing its videoId:

```bash
npm run extract-clips [videoId]
```

Example:
```bash
npm run extract-clips 1767796104866_5ep6yj2y2
```

---

## What Happens

1. **Script finds a video** with markers from Firestore
2. **Downloads video** from GCS to temporary directory
3. **For each marker:**
   - Extracts 30-second clip (15s before marker, 15s after)
   - Uploads clip to: `gs://obs-pipeline-videos/clips/{videoId}/`
   - Clip filename: `{originalName}_clip_{index}_{markerTime}s.mp4`
4. **Updates Firestore** with:
   - `clips`: Array of clip objects with GCS paths
   - `clipsExtracted`: `true`
   - `clipsExtractedAt`: Timestamp
   - `clipsCount`: Number of clips extracted

---

## Example Output

```
🚀 Initializing Clip Extractor...

✅ Firebase initialized
✅ Google Cloud Storage initialized
✅ Temp directory ready: /var/folders/.../billiard-clips
✅ ffmpeg found

📋 Looking for videos with markers to process...

🎬 Processing video: 2026-01-07 22-16-48.mp4
📍 Found 5 marker(s): 1113.2, 1121.87, 2354.73, 2407.07, 2494.77

📥 Downloading video from GCS...
✅ Video downloaded: 2026-01-07 22-16-48.mp4

✂️  Extracting clip 1/5 at 1113.20s...
✅ Clip 1 uploaded: gs://obs-pipeline-videos/clips/.../clip_1_1113.2s.mp4

✂️  Extracting clip 2/5 at 1121.87s...
✅ Clip 2 uploaded: gs://obs-pipeline-videos/clips/.../clip_2_1121.87s.mp4

...

✅ Updated Firestore with 5 clip(s)
🎉 Successfully extracted 5 clip(s) from 2026-01-07 22-16-48.mp4
```

---

## Configuration

You can adjust clip settings in `extract-clips.js`:

```javascript
const CONFIG = {
  CLIP_DURATION: 30, // Total clip duration (seconds)
  CLIP_BEFORE: 15,   // Seconds before marker
  CLIP_AFTER: 15,    // Seconds after marker
};
```

---

## Verify Results

### Check Firestore

1. Go to: https://console.firebase.google.com/project/videoeditor-2508b/firestore
2. Open the `videos` collection
3. Find your processed video
4. Check for:
   - `clipsExtracted: true`
   - `clips`: Array of clip objects
   - `clipsCount`: Number of clips

### Check GCS

1. Go to: https://console.cloud.google.com/storage/browser/obs-pipeline-videos
2. Navigate to `clips/{videoId}/`
3. You should see all extracted clip files

---

## Troubleshooting

**"ffmpeg not found"**
- Install ffmpeg: `brew install ffmpeg`
- Verify: `ffmpeg -version`

**"Video not found or has no markers"**
- Make sure the video has `hasMarkers: true` in Firestore
- Check that `clipsExtracted` is not already `true`

**"Error extracting clip"**
- Check video file is valid
- Verify marker timestamps are within video duration
- Check disk space in temp directory

**"Error downloading video"**
- Verify GCS path is correct
- Check service account permissions
- Ensure video exists in GCS bucket

---

## Next Steps

Once clips are extracted, you can:
- Download clips from GCS for editing
- Use clips for social media posts
- Process clips further (add effects, combine, etc.)
- Automate clip processing with Cloud Functions

---

**Ready to test!** Install ffmpeg and run `npm run extract-clips` to process your first video with markers! 🎬

