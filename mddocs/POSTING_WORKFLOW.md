# Simple Posting Workflow - Facebook & X (Twitter)

## Quick Overview

After recording and processing, you'll have a combined highlights video ready to post. Here's the simplest way to get it and post it.

---

## Step 1: Download Your Combined Video

### Option A: From Google Cloud Console (Easiest)

1. Go to: https://console.cloud.google.com/storage/browser/obs-pipeline-videos
2. Navigate to: `finals/{videoId}/`
3. Find your `*_highlights.mp4` file
4. Click the download icon (⬇️) next to the file
5. Video downloads to your computer

### Option B: From Firestore (Find Video ID)

1. Go to: https://console.firebase.google.com/project/videoeditor-2508b/firestore
2. Open `videos` collection
3. Find your video document
4. Look for `combinedVideo` field - it shows the GCS path
5. Copy the path and download from GCS

---

## Step 2: Post to Facebook

### Quick Steps:
1. **Go to Facebook:**
   - Open Facebook.com or Facebook app
   - Go to your Page or Profile

2. **Create Post:**
   - Click "Photo/Video" or "What's on your mind?"
   - Select your downloaded highlights video

3. **Add Caption (Optional):**
   ```
   🎱 Billiard highlights from today's session!
   #Billiards #Pool #Highlights
   ```

4. **Post Settings:**
   - Choose audience (Public/Friends/etc.)
   - Click "Post"

### Tips:
- Facebook supports videos up to 240 minutes
- Best format: MP4, H.264
- Recommended: 1080p or 720p
- Your 30-second clips combined = perfect for Facebook

---

## Step 3: Post to X (Twitter)

### Quick Steps:
1. **Go to X/Twitter:**
   - Open twitter.com or X app
   - Click the compose button (✏️)

2. **Upload Video:**
   - Click the media icon (📷)
   - Select your downloaded highlights video

3. **Add Caption:**
   ```
   🎱 Billiard highlights! #Billiards #Pool
   ```

4. **Post:**
   - Click "Post" or "Tweet"

### Important X Limits:
- **Video length:** Max 2 minutes 20 seconds (140 seconds)
- **File size:** Max 512MB
- **If your video is longer:** You'll need to trim it or post multiple tweets

### If Video is Too Long for X:
**Option 1: Post Individual Clips**
- Download individual clips from `clips/{videoId}/` folder
- Each clip is 30 seconds - perfect for X!
- Post 2-3 best clips separately

**Option 2: Trim Combined Video**
- Use QuickTime (Mac) or any video editor
- Trim to 2 minutes
- Post the trimmed version

---

## Complete Workflow Summary

```
1. Record game → Press Fn+F9 for highlights
2. Stop recording → Auto-uploads to GCS
3. Run: npm run extract-clips
4. Run: npm run combine-clips
5. Download combined video from GCS
6. Post to Facebook (full video)
7. Post to X (full video if <2:20, or individual clips)
```

---

## Quick Commands Reference

```bash
# Extract clips from markers
npm run extract-clips

# Combine clips into one video
npm run combine-clips [videoId]

# Or process most recent automatically
npm run combine-clips
```

---

## Pro Tips

### For Facebook:
- ✅ Post full highlights video (any length)
- ✅ Add engaging caption
- ✅ Use relevant hashtags
- ✅ Post during peak hours (evening/weekends)

### For X (Twitter):
- ✅ If combined video < 2:20 → Post full video
- ✅ If combined video > 2:20 → Post best 2-3 individual clips
- ✅ Thread multiple clips for longer highlights
- ✅ Use trending hashtags

### Time-Saving:
- Keep both terminals running (watcher + marker server)
- Process clips right after recording
- Download and post while fresh in mind

---

## Troubleshooting

**"Video too long for X"**
- Download individual clips instead
- Or trim combined video to 2 minutes

**"Can't find video in GCS"**
- Check Firestore for `combinedVideo` field
- Verify video was processed: `clipsCombined: true`

**"Video quality looks low"**
- Original video quality is preserved
- Re-download if needed
- Check GCS file size matches expectations

---

**That's it!** Simple 3-step process: Download → Post to Facebook → Post to X 🎉

