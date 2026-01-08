/**
 * Clip Extraction Script
 * 
 * Reads videos with markers from Firestore and extracts highlight clips
 * around each marker timestamp.
 * 
 * Usage:
 *   node extract-clips.js [videoId]
 *   - If videoId provided: process that specific video
 *   - If no videoId: process all videos with markers that haven't been processed
 */

const admin = require('firebase-admin');
const { Storage } = require('@google-cloud/storage');
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const execPromise = util.promisify(exec);

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  PROJECT_ID: 'videoeditor-2508b',
  BUCKET_NAME: 'obs-pipeline-videos',
  SERVICE_ACCOUNT_PATH: './service-account-key.json',
  
  // Clip settings
  CLIP_DURATION: 30, // Total clip duration in seconds (15s before + 15s after marker)
  CLIP_BEFORE: 15,   // Seconds before marker
  CLIP_AFTER: 15,    // Seconds after marker
  
  // Temporary directory for processing
  TEMP_DIR: path.join(os.tmpdir(), 'billiard-clips'),
};

// ============================================
// INITIALIZATION
// ============================================
let storage = null;
let bucket = null;
let db = null;

async function initialize() {
  console.log('🚀 Initializing Clip Extractor...\n');
  
  // Initialize Firebase Admin
  try {
    const serviceAccount = require(CONFIG.SERVICE_ACCOUNT_PATH);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: CONFIG.PROJECT_ID
    });
    db = admin.firestore();
    console.log('✅ Firebase initialized');
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    process.exit(1);
  }
  
  // Initialize GCS
  try {
    storage = new Storage({
      projectId: CONFIG.PROJECT_ID,
      keyFilename: CONFIG.SERVICE_ACCOUNT_PATH
    });
    bucket = storage.bucket(CONFIG.BUCKET_NAME);
    console.log('✅ Google Cloud Storage initialized');
  } catch (error) {
    console.error('❌ GCS initialization failed:', error.message);
    process.exit(1);
  }
  
  // Create temp directory
  try {
    await fs.mkdir(CONFIG.TEMP_DIR, { recursive: true });
    console.log(`✅ Temp directory ready: ${CONFIG.TEMP_DIR}\n`);
  } catch (error) {
    console.error('❌ Failed to create temp directory:', error.message);
    process.exit(1);
  }
}

// ============================================
// FFMPEG UTILITIES
// ============================================
async function checkFFmpeg() {
  try {
    await execPromise('which ffmpeg');
    return true;
  } catch (error) {
    return false;
  }
}

async function extractClip(videoPath, markerTime, clipIndex, outputPath) {
  // Calculate start time (marker time - CLIP_BEFORE, but not before 0)
  const startTime = Math.max(0, markerTime - CONFIG.CLIP_BEFORE);
  
  // FFmpeg command to extract clip
  const command = `ffmpeg -i "${videoPath}" -ss ${startTime} -t ${CONFIG.CLIP_DURATION} -c copy -avoid_negative_ts make_zero "${outputPath}"`;
  
  try {
    await execPromise(command);
    return true;
  } catch (error) {
    console.error(`❌ Error extracting clip ${clipIndex}:`, error.message);
    return false;
  }
}

// ============================================
// GCS OPERATIONS
// ============================================
async function downloadVideo(gcsPath, localPath) {
  try {
    // Extract bucket path from gs:// URL
    const pathMatch = gcsPath.match(/gs:\/\/([^\/]+)\/(.+)/);
    if (!pathMatch) {
      throw new Error(`Invalid GCS path: ${gcsPath}`);
    }
    
    const [, bucketName, filePath] = pathMatch;
    const file = storage.bucket(bucketName).file(filePath);
    
    console.log(`📥 Downloading video from GCS...`);
    await file.download({ destination: localPath });
    console.log(`✅ Video downloaded: ${path.basename(localPath)}`);
    return true;
  } catch (error) {
    console.error(`❌ Error downloading video:`, error.message);
    return false;
  }
}

async function uploadClip(localPath, videoId, clipIndex) {
  const fileName = path.basename(localPath);
  const destination = `clips/${videoId}/${fileName}`;
  
  try {
    console.log(`📤 Uploading clip to GCS...`);
    await bucket.upload(localPath, {
      destination,
      metadata: {
        contentType: 'video/mp4',
      }
    });
    
    return `gs://${CONFIG.BUCKET_NAME}/${destination}`;
  } catch (error) {
    console.error(`❌ Error uploading clip:`, error.message);
    return null;
  }
}

// ============================================
// FIRESTORE OPERATIONS
// ============================================
async function getVideoWithMarkers(videoId = null) {
  if (videoId) {
    // Get specific video
    const doc = await db.collection('videos').doc(videoId).get();
    if (!doc.exists) {
      return null;
    }
    const data = doc.data();
    if (data.hasMarkers && data.markers && data.markers.length > 0) {
      return { id: doc.id, ...data };
    }
    return null;
  } else {
    // Get all videos with markers (simplified query to avoid index requirement)
    // We'll filter out already processed ones in code
    const snapshot = await db.collection('videos')
      .where('hasMarkers', '==', true)
      .limit(10) // Get a few videos to check
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    // Find first video that hasn't been processed yet
    for (const doc of snapshot.docs) {
      const data = doc.data();
      // Skip if already processed
      if (data.clipsExtracted === true) {
        continue;
      }
      // Make sure it has markers
      if (data.markers && data.markers.length > 0) {
        return { id: doc.id, ...data };
      }
    }
    
    return null;
  }
}

async function updateVideoWithClips(videoId, clips) {
  try {
    await db.collection('videos').doc(videoId).update({
      clips: clips,
      clipsExtracted: true,
      clipsExtractedAt: admin.firestore.FieldValue.serverTimestamp(),
      clipsCount: clips.length
    });
    console.log(`✅ Updated Firestore with ${clips.length} clip(s)`);
  } catch (error) {
    console.error(`❌ Error updating Firestore:`, error.message);
  }
}

// ============================================
// MAIN PROCESSING
// ============================================
async function processVideo(videoData) {
  const { id: videoId, fileName, gcsPath, markers } = videoData;
  
  console.log(`\n🎬 Processing video: ${fileName}`);
  console.log(`📍 Found ${markers.length} marker(s): ${markers.join(', ')}s\n`);
  
  // Download video
  const localVideoPath = path.join(CONFIG.TEMP_DIR, fileName);
  const downloaded = await downloadVideo(gcsPath, localVideoPath);
  if (!downloaded) {
    return false;
  }
  
  // Extract clips for each marker
  const clips = [];
  
  for (let i = 0; i < markers.length; i++) {
    const markerTime = markers[i];
    const clipFileName = `${path.parse(fileName).name}_clip_${i + 1}_${markerTime.toFixed(1)}s.mp4`;
    const clipPath = path.join(CONFIG.TEMP_DIR, clipFileName);
    
    console.log(`✂️  Extracting clip ${i + 1}/${markers.length} at ${markerTime.toFixed(2)}s...`);
    
    const extracted = await extractClip(localVideoPath, markerTime, i + 1, clipPath);
    if (!extracted) {
      continue;
    }
    
    // Upload clip to GCS
    const clipGcsPath = await uploadClip(clipPath, videoId, i + 1);
    if (!clipGcsPath) {
      continue;
    }
    
    clips.push({
      markerTime: markerTime,
      clipIndex: i + 1,
      gcsPath: clipGcsPath,
      fileName: clipFileName,
      duration: CONFIG.CLIP_DURATION,
    });
    
    console.log(`✅ Clip ${i + 1} uploaded: ${clipGcsPath}\n`);
    
    // Clean up local clip file
    try {
      await fs.unlink(clipPath);
    } catch (error) {
      // Ignore cleanup errors
    }
  }
  
  // Clean up local video file
  try {
    await fs.unlink(localVideoPath);
  } catch (error) {
    // Ignore cleanup errors
  }
  
  // Update Firestore
  if (clips.length > 0) {
    await updateVideoWithClips(videoId, clips);
    console.log(`🎉 Successfully extracted ${clips.length} clip(s) from ${fileName}\n`);
    return true;
  } else {
    console.log(`⚠️  No clips were successfully extracted\n`);
    return false;
  }
}

// ============================================
// MAIN
// ============================================
async function main() {
  await initialize();
  
  // Check for ffmpeg
  const hasFFmpeg = await checkFFmpeg();
  if (!hasFFmpeg) {
    console.error('❌ ffmpeg not found. Please install ffmpeg:');
    console.error('   brew install ffmpeg');
    process.exit(1);
  }
  console.log('✅ ffmpeg found\n');
  
  // Get video ID from command line or find one with markers
  const videoId = process.argv[2] || null;
  
  if (videoId) {
    console.log(`📋 Processing specific video: ${videoId}\n`);
  } else {
    console.log(`📋 Looking for videos with markers to process...\n`);
  }
  
  const videoData = await getVideoWithMarkers(videoId);
  
  if (!videoData) {
    if (videoId) {
      console.log(`❌ Video ${videoId} not found or has no markers`);
    } else {
      console.log(`✅ No videos with unprocessed markers found`);
    }
    process.exit(0);
  }
  
  await processVideo(videoData);
}

// Run
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

