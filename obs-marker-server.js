/**
 * OBS Marker Server
 * 
 * Connects to OBS WebSocket and provides HTTP endpoint for saving markers.
 * When triggered via HTTP POST /marker, gets current recording time from OBS
 * and writes it to markers.txt file.
 * 
 * Usage:
 * 1. Make sure OBS WebSocket plugin is installed and enabled
 * 2. Start recording in OBS
 * 3. Run: node obs-marker-server.js
 * 4. Trigger markers via: curl -X POST http://localhost:3000/marker
 *    or use a hotkey app to call the endpoint
 */

const OBSWebSocket = require('obs-websocket-js').default;
const http = require('http');
const fs = require('fs').promises;
const path = require('path');

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  OBS_WEBSOCKET_PORT: 4455,
  OBS_WEBSOCKET_PASSWORD: '', // Leave empty if no password set
  HTTP_PORT: 3000,
  MARKER_FILE: path.join(__dirname, 'markers.txt'),
};

// ============================================
// OBS WEBSOCKET CONNECTION
// ============================================
const obs = new OBSWebSocket();
let isConnected = false;
let isRecording = false;

async function connectToOBS() {
  try {
    // obs-websocket-js connect() expects: connect(url, password?, identificationParams?)
    const url = `ws://127.0.0.1:${CONFIG.OBS_WEBSOCKET_PORT}`;
    const password = CONFIG.OBS_WEBSOCKET_PASSWORD || undefined;

    await obs.connect(url, password);
    isConnected = true;
    console.log('✅ Connected to OBS WebSocket');

    // Check initial recording status
    try {
      const status = await obs.call('GetRecordStatus');
      isRecording = status.outputActive;
      if (isRecording) {
        console.log('📹 Recording is active');
      }
    } catch (error) {
      // Recording status might not be available yet
      console.log('ℹ️  Recording status will be checked when marker is triggered');
    }

    // Listen for recording state changes
    obs.on('RecordStateChanged', (data) => {
      isRecording = data.outputActive;
      if (isRecording) {
        console.log('📹 Recording started');
      } else {
        console.log('⏹️  Recording stopped');
      }
    });

    // Handle disconnection
    obs.on('ConnectionClosed', () => {
      isConnected = false;
      console.log('⚠️  OBS WebSocket disconnected. Attempting to reconnect...');
      setTimeout(connectToOBS, 5000);
    });

  } catch (error) {
    console.error('❌ Failed to connect to OBS WebSocket:', error.message);
    console.error('   Make sure OBS WebSocket plugin is installed and enabled');
    console.error('   Check OBS → Tools → WebSocket Server Settings');
    console.error('   Retrying in 5 seconds...');
    setTimeout(connectToOBS, 5000);
  }
}

// ============================================
// MARKER FUNCTIONS
// ============================================
async function getRecordingTime() {
  try {
    // Get the current recording status
    const recordStatus = await obs.call('GetRecordStatus');
    
    if (!recordStatus.outputActive) {
      return null;
    }

    // Get output timecode from record status
    // OBS WebSocket can return timecode as either:
    // 1. Number (nanoseconds) - older versions
    // 2. String (HH:MM:SS.mmm format) - newer versions
    // 3. outputDuration (milliseconds) - fallback
    
    let timeSeconds = null;
    
    if (recordStatus.outputTimecode !== undefined && recordStatus.outputTimecode !== null) {
      // Check if it's a string (HH:MM:SS.mmm format)
      if (typeof recordStatus.outputTimecode === 'string') {
        // Parse timecode string like "00:03:16.099"
        const timecodeMatch = recordStatus.outputTimecode.match(/(\d+):(\d+):(\d+)\.(\d+)/);
        if (timecodeMatch) {
          const hours = parseInt(timecodeMatch[1], 10);
          const minutes = parseInt(timecodeMatch[2], 10);
          const seconds = parseInt(timecodeMatch[3], 10);
          const milliseconds = parseInt(timecodeMatch[4], 10);
          timeSeconds = hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
        }
      } else if (typeof recordStatus.outputTimecode === 'number') {
        // It's a number (nanoseconds), convert to seconds
        timeSeconds = recordStatus.outputTimecode / 1000000000;
      }
      
      // Validate the result
      if (timeSeconds !== null && (!isNaN(timeSeconds) && isFinite(timeSeconds))) {
        return timeSeconds;
      }
    }
    
    // Fallback: Use outputDuration (in milliseconds)
    if (recordStatus.outputDuration !== undefined && recordStatus.outputDuration !== null) {
      timeSeconds = recordStatus.outputDuration / 1000; // Convert milliseconds to seconds
      if (!isNaN(timeSeconds) && isFinite(timeSeconds)) {
        return timeSeconds;
      }
    }

    // If outputTimecode is not available, try alternative method
    // Some OBS versions might return it differently
    console.warn('⚠️  outputTimecode not found in GetRecordStatus response');
    console.warn('   Response:', JSON.stringify(recordStatus, null, 2));
    
    // Try to get output status as fallback
    try {
      const outputStatus = await obs.call('GetOutputStatus');
      if (outputStatus && outputStatus.outputTimecode) {
        const timeSeconds = outputStatus.outputTimecode / 1000000000;
        if (!isNaN(timeSeconds) && isFinite(timeSeconds)) {
          return timeSeconds;
        }
      }
    } catch (fallbackError) {
      // Fallback method failed, continue
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error getting recording time:', error.message);
    return null;
  }
}

async function saveMarker(timestamp) {
  try {
    // Ensure marker file exists
    try {
      await fs.access(CONFIG.MARKER_FILE);
    } catch {
      // File doesn't exist, create it
      await fs.writeFile(CONFIG.MARKER_FILE, '');
    }

    // Append timestamp to file
    const timestampStr = timestamp.toFixed(2) + '\n';
    await fs.appendFile(CONFIG.MARKER_FILE, timestampStr, 'utf-8');
    
    console.log(`✅ Marker saved: ${timestamp.toFixed(2)}s`);
    return true;
  } catch (error) {
    console.error('❌ Error saving marker:', error.message);
    return false;
  }
}

async function handleMarkerRequest() {
  if (!isConnected) {
    return { success: false, message: 'Not connected to OBS WebSocket' };
  }

  // Check recording status directly (don't rely on cached isRecording variable)
  let recordingActive = false;
  try {
    const status = await obs.call('GetRecordStatus');
    recordingActive = status.outputActive;
    // Update the cached variable
    isRecording = recordingActive;
  } catch (error) {
    console.error('❌ Error checking recording status:', error.message);
    return { success: false, message: 'Could not check recording status. Make sure OBS is running.' };
  }

  if (!recordingActive) {
    return { success: false, message: 'Not recording. Start recording in OBS first.' };
  }

  const timestamp = await getRecordingTime();
  if (timestamp === null || isNaN(timestamp)) {
    return { success: false, message: 'Could not get recording time. Make sure recording is active in OBS.' };
  }

  const saved = await saveMarker(timestamp);
  if (!saved) {
    return { success: false, message: 'Failed to save marker to file' };
  }

  return { success: true, timestamp: timestamp.toFixed(2) };
}

// ============================================
// HTTP SERVER
// ============================================
const server = http.createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/marker' && req.method === 'POST') {
    const result = await handleMarkerRequest();
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } else if (req.url === '/status' && req.method === 'GET') {
    // Status endpoint for checking connection
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      connected: isConnected,
      recording: isRecording,
      markerFile: CONFIG.MARKER_FILE
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

// ============================================
// STARTUP
// ============================================
async function start() {
  console.log('🚀 Starting OBS Marker Server...\n');
  
  // Start HTTP server
  server.listen(CONFIG.HTTP_PORT, () => {
    console.log(`✅ HTTP server running on http://localhost:${CONFIG.HTTP_PORT}`);
    console.log(`📍 Marker endpoint: POST http://localhost:${CONFIG.HTTP_PORT}/marker`);
    console.log(`📊 Status endpoint: GET http://localhost:${CONFIG.HTTP_PORT}/status`);
    console.log(`📝 Marker file: ${CONFIG.MARKER_FILE}\n`);
  });

  // Connect to OBS
  await connectToOBS();

  console.log('✅ Marker server ready!\n');
  console.log('💡 Press Ctrl+C to stop\n');
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  if (isConnected) {
    await obs.disconnect();
  }
  server.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});

// Start the server
start().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

