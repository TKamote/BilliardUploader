/**
 * Combine Clips Script
 * 
 * Downloads clips from a video and combines them into a single compilation video.
 * 
 * Usage:
 *   node combine-clips.js [videoId]
 *   - If videoId provided: combine clips for that video
 *   - If no videoId: combine clips for the most recent video with clips
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
  
  // Transition settings (optional - can add fade/transition between clips)
  ADD_TRANSITIONS: false, // Set to true to add fade transitions between clips
  
  // Temporary directory for processing
  TEMP_DIR: path.join(os.tmpdir(), 'billiard-combine'),
};

// ============================================
// INITIALIZATION
// ============================================
let storage = null;
let bucket = null;
let db = null;

async function initialize() {
  console.log('🚀 Initializing Clip Combiner...\n');
  
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

async function downloadClip(gcsPath, localPath) {
  try {
    const pathMatch = gcsPath.match(/gs:\/\/([^\/]+)\/(.+)/);
    if (!pathMatch) {
      throw new Error(`Invalid GCS path: ${gcsPath}`);
    }
    
    const [, bucketName, filePath] = pathMatch;
    const file = storage.bucket(bucketName).file(filePath);
    
    await file.download({ destination: localPath });
    return true;
  } catch (error) {
    console.error(`❌ Error downloading clip:`, error.message);
    return false;
  }
}

async function combineClips(clipPaths, outputPath) {
  // Create a file list for ffmpeg concat
  const listFile = path.join(CONFIG.TEMP_DIR, 'clips_list.txt');
  const listContent = clipPaths.map(p => `file '${p}'`).join('\n');
  await fs.writeFile(listFile, listContent);
  
  // FFmpeg command to concatenate clips
  // Using concat demuxer for better compatibility
  const command = `ffmpeg -f concat -safe 0 -i "${listFile}" -c copy "${outputPath}"`;
  
  try {
    await execPromise(command);
    return true;
  } catch (error) {
    console.error(`❌ Error combining clips:`, error.message);
    return false;
  }
}

async function uploadCombinedVideo(localPath, videoId, fileName) {
  const destination = `finals/${videoId}/${fileName}`;
  
  try {
    console.log(`📤 Uploading combined video to GCS...`);
    await bucket.upload(localPath, {
      destination,
      metadata: {
        contentType: 'video/mp4',
      }
    });
    
    return `gs://${CONFIG.BUCKET_NAME}/${destination}`;
  } catch (error) {
    console.error(`❌ Error uploading combined video:`, error.message);
    return null;
  }
}

// ============================================
// FIRESTORE OPERATIONS
// ============================================
async function getVideoWithClips(videoId = null) {
  if (videoId) {
    const doc = await db.collection('videos').doc(videoId).get();
    if (!doc.exists) {
      return null;
    }
    const data = doc.data();
    if (data.clips && data.clips.length > 0) {
      return { id: doc.id, ...data };
    }
    return null;
  } else {
    // Get videos with clipsExtracted (simplified query to avoid index requirement)
    // We'll filter and sort in code
    const snapshot = await db.collection('videos')
      .where('clipsExtracted', '==', true)
      .limit(10) // Get a few videos to check
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    // Find most recent video that hasn't been combined yet
    const videos = [];
    for (const doc of snapshot.docs) {
      const data = doc.data();
      // Skip if already combined
      if (data.clipsCombined === true) {
        continue;
      }
      // Make sure it has clips
      if (data.clips && data.clips.length > 0) {
        videos.push({ id: doc.id, ...data });
      }
    }
    
    // Sort by uploadedAt descending and return most recent
    if (videos.length > 0) {
      videos.sort((a, b) => {
        const aTime = a.uploadedAt?.toMillis() || 0;
        const bTime = b.uploadedAt?.toMillis() || 0;
        return bTime - aTime;
      });
      return videos[0];
    }
    
    return null;
  }
}

async function updateVideoWithCombined(videoId, combinedVideoPath) {
  try {
    await db.collection('videos').doc(videoId).update({
      combinedVideo: combinedVideoPath,
      clipsCombined: true,
      clipsCombinedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`✅ Updated Firestore with combined video`);
  } catch (error) {
    console.error(`❌ Error updating Firestore:`, error.message);
  }
}

// ============================================
// MAIN PROCESSING
// ============================================
async function processVideo(videoData) {
  const { id: videoId, fileName, clips } = videoData;
  
  console.log(`\n🎬 Combining clips for: ${fileName}`);
  console.log(`📹 Found ${clips.length} clip(s) to combine\n`);
  
  // Download all clips
  const localClipPaths = [];
  
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const clipFileName = path.basename(clip.gcsPath);
    const localClipPath = path.join(CONFIG.TEMP_DIR, clipFileName);
    
    console.log(`📥 Downloading clip ${i + 1}/${clips.length}...`);
    const downloaded = await downloadClip(clip.gcsPath, localClipPath);
    if (!downloaded) {
      console.log(`⚠️  Skipping clip ${i + 1}`);
      continue;
    }
    
    localClipPaths.push(localClipPath);
  }
  
  if (localClipPaths.length === 0) {
    console.log(`❌ No clips were downloaded successfully`);
    return false;
  }
  
  // Combine clips
  const combinedFileName = `${path.parse(fileName).name}_highlights.mp4`;
  const combinedPath = path.join(CONFIG.TEMP_DIR, combinedFileName);
  
  console.log(`\n🔗 Combining ${localClipPaths.length} clip(s)...`);
  const combined = await combineClips(localClipPaths, combinedPath);
  if (!combined) {
    return false;
  }
  
  console.log(`✅ Clips combined successfully`);
  
  // Upload combined video
  const combinedGcsPath = await uploadCombinedVideo(combinedPath, videoId, combinedFileName);
  if (!combinedGcsPath) {
    return false;
  }
  
  console.log(`✅ Combined video uploaded: ${combinedGcsPath}`);
  
  // Update Firestore
  await updateVideoWithCombined(videoId, combinedGcsPath);
  
  // Cleanup local files
  for (const clipPath of localClipPaths) {
    try {
      await fs.unlink(clipPath);
    } catch (error) {
      // Ignore cleanup errors
    }
  }
  try {
    await fs.unlink(combinedPath);
  } catch (error) {
    // Ignore cleanup errors
  }
  
  console.log(`\n🎉 Successfully combined ${localClipPaths.length} clip(s) into highlights video!\n`);
  return true;
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
  
  // Get video ID from command line or find one with clips
  const videoId = process.argv[2] || null;
  
  if (videoId) {
    console.log(`📋 Combining clips for video: ${videoId}\n`);
  } else {
    console.log(`📋 Looking for videos with clips to combine...\n`);
  }
  
  const videoData = await getVideoWithClips(videoId);
  
  if (!videoData) {
    if (videoId) {
      console.log(`❌ Video ${videoId} not found or has no clips`);
    } else {
      console.log(`✅ No videos with uncombined clips found`);
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

