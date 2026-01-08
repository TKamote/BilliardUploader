/**
 * OBS Watcher - Single File Uploader
 * 
 * Setup:
 * 1. Create folder: C:\Scripts\BilliardUploader (or any path)
 * 2. Save this file as index.js
 * 3. Run: npm install firebase-admin @google-cloud/storage chokidar
 * 4. Edit the CONFIG section below with your settings
 * 5. Run: node index.js
 * 
 * It will watch your OBS folder and auto-upload to Firebase/GCS
 */

const admin = require('firebase-admin');
const { Storage } = require('@google-cloud/storage');
const chokidar = require('chokidar');
const fs = require('fs').promises;
const path = require('path');

// ============================================
// CONFIGURATION - EDIT THESE VALUES
// ============================================
const CONFIG = {
  OBS_FOLDER: '/Users/davidv.onquit/Movies',
  PROJECT_ID: 'videoeditor-2508b',
  BUCKET_NAME: 'obs-pipeline-videos', // ✅ Change this!
  SERVICE_ACCOUNT_PATH: './service-account-key.json',

  // Optional: Marker file path (if using OBS hotkey method)
  MARKER_FILE: '/Users/davidv.onquit/Scripts/BilliardUploader/markers.txt', // ✅ Updated!

  // File settings (leave these as-is)
  WATCH_EXTENSIONS: ['.mp4', '.mkv'],
  MIN_FILE_SIZE_MB: 10,
  STABILITY_WAIT_MS: 5000,
};

// ============================================
// INITIALIZATION
// ============================================
let storage = null;
let bucket = null;
let db = null;
let processingFiles = new Set();

async function initialize() {
  console.log('🚀 Initializing OBS Watcher...\n');
  
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
    console.error('   Make sure SERVICE_ACCOUNT_PATH points to your service account JSON file');
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
  
  // Verify OBS folder exists
  try {
    await fs.access(CONFIG.OBS_FOLDER);
    console.log(`✅ OBS folder verified: ${CONFIG.OBS_FOLDER}\n`);
  } catch (error) {
    console.error(`❌ OBS folder not found: ${CONFIG.OBS_FOLDER}`);
    console.error('   Please update OBS_FOLDER in the CONFIG section');
    process.exit(1);
  }
}

// ============================================
// FILE UTILITIES
// ============================================
async function getFileSize(filePath) {
  const stats = await fs.stat(filePath);
  return stats.size / (1024 * 1024); // MB
}

function isValidVideoFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return CONFIG.WATCH_EXTENSIONS.includes(ext);
}

async function waitForFileStable(filePath) {
  const checkInterval = 1000;
  const checks = Math.ceil(CONFIG.STABILITY_WAIT_MS / checkInterval);
  let previousSize = 0;
  let stableCount = 0;
  const requiredStableChecks = 3;
  
  for (let i = 0; i < checks; i++) {
    try {
      const stats = await fs.stat(filePath);
      const currentSize = stats.size;
      
      if (currentSize === previousSize) {
        stableCount++;
        if (stableCount >= requiredStableChecks) {
          return true;
        }
      } else {
        stableCount = 0;
      }
      
      previousSize = currentSize;
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
  }
  
  return false;
}

// ============================================
// MARKER FILE SUPPORT (Optional)
// ============================================
async function readMarkers() {
  if (!CONFIG.MARKER_FILE) return null;
  
  try {
    const content = await fs.readFile(CONFIG.MARKER_FILE, 'utf-8');
    const markers = content.trim().split('\n').filter(line => line.trim());
    // Clear the file after reading
    await fs.writeFile(CONFIG.MARKER_FILE, '');
    return markers.map(m => parseFloat(m.trim())).filter(m => !isNaN(m));
  } catch (error) {
    return null;
  }
}

// ============================================
// UPLOAD FUNCTIONS
// ============================================
async function uploadToGCS(localFilePath, fileName) {
  const destination = `videos/${fileName}`;
  console.log(`📤 Uploading to gs://${CONFIG.BUCKET_NAME}/${destination}...`);
  
  await bucket.upload(localFilePath, {
    destination,
    metadata: {
      contentType: 'video/mp4',
      metadata: {
        uploadedBy: 'obs-watcher',
        uploadedAt: new Date().toISOString()
      }
    }
  });
  
  return `gs://${CONFIG.BUCKET_NAME}/${destination}`;
}

async function createFirestoreDocument(fileName, gcsPath, fileSize, markers) {
  const videoId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const documentData = {
    videoId,
    fileName,
    gcsPath,
    uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
    status: 'uploaded',
    metadata: {
      fileSize: fileSize * 1024 * 1024, // Convert to bytes
      uploadedBy: 'obs-watcher'
    }
  };
  
  // Add markers if available
  if (markers && markers.length > 0) {
    documentData.markers = markers;
    documentData.hasMarkers = true;
  }
  
  await db.collection('videos').doc(videoId).set(documentData);
  return videoId;
}

// ============================================
// FILE PROCESSING
// ============================================
async function processFile(filePath) {
  if (processingFiles.has(filePath)) {
    return;
  }
  
  if (!isValidVideoFile(filePath)) {
    return;
  }
  
  const fileName = path.basename(filePath);
  console.log(`\n📹 New file detected: ${fileName}`);
  
  // Check file size
  const fileSizeMB = await getFileSize(filePath);
  if (fileSizeMB < CONFIG.MIN_FILE_SIZE_MB) {
    console.log(`⏭️  Skipping: File too small (${fileSizeMB.toFixed(2)}MB)`);
    return;
  }
  
  // Wait for file to stabilize
  console.log(`⏳ Waiting for file to stabilize...`);
  const isStable = await waitForFileStable(filePath);
  if (!isStable) {
    console.log(`⚠️  File did not stabilize, skipping...`);
    return;
  }
  
  processingFiles.add(filePath);
  
  try {
    // Read markers if available
    const markers = await readMarkers();
    if (markers) {
      console.log(`📍 Found ${markers.length} marker(s): ${markers.join(', ')}`);
    }
    
    // Upload to GCS
    console.log(`☁️  Uploading to Google Cloud Storage...`);
    const gcsPath = await uploadToGCS(filePath, fileName);
    console.log(`✅ Upload complete: ${gcsPath}`);
    
    // Create Firestore document
    console.log(`📝 Creating Firestore document...`);
    const videoId = await createFirestoreDocument(fileName, gcsPath, fileSizeMB, markers);
    console.log(`✅ Firestore document created: ${videoId}`);
    
    console.log(`🎉 Successfully processed: ${fileName}\n`);
    
  } catch (error) {
    console.error(`❌ Error processing ${fileName}:`, error.message);
  } finally {
    processingFiles.delete(filePath);
  }
}

// ============================================
// MAIN WATCHER
// ============================================
async function startWatcher() {
  await initialize();
  
  console.log('👀 Starting file watcher...');
  console.log(`📁 Watching: ${CONFIG.OBS_FOLDER}`);
  console.log(`📝 Extensions: ${CONFIG.WATCH_EXTENSIONS.join(', ')}`);
  if (CONFIG.MARKER_FILE) {
    console.log(`📍 Marker file: ${CONFIG.MARKER_FILE}`);
  }
  console.log('\n✅ Watcher ready. Waiting for OBS recordings...\n');
  
  const watcher = chokidar.watch(CONFIG.OBS_FOLDER, {
    // Ignore hidden files/directories and common system directories
    ignored: [
      /(^|[\/\\])\../,  // Hidden files
      /(^|[\/\\])TV([\/\\]|$)/,  // TV directory (if permission issues)
      /(^|[\/\\])\.DS_Store/,  // macOS system files
    ],
    persistent: true,
    ignoreInitial: true,
    ignorePermissionErrors: true,  // Ignore permission errors gracefully
    awaitWriteFinish: {
      stabilityThreshold: CONFIG.STABILITY_WAIT_MS,
      pollInterval: 1000
    }
  });
  
  watcher.on('add', (filePath) => {
    processFile(filePath).catch(console.error);
  });
  
  watcher.on('change', (filePath) => {
    if (!processingFiles.has(filePath)) {
      processFile(filePath).catch(console.error);
    }
  });
  
  watcher.on('error', (error) => {
    // Only log non-permission errors as warnings
    if (error.code === 'EPERM' || error.code === 'EACCES') {
      console.warn(`⚠️  Permission denied for: ${error.path || error.message} (ignoring)`);
    } else {
      console.error('❌ Watcher error:', error.message);
    }
  });
  
  watcher.on('ready', () => {
    console.log('✅ File watcher initialized successfully');
  });
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    await watcher.close();
    process.exit(0);
  });
}

// ============================================
// START
// ============================================
startWatcher().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

