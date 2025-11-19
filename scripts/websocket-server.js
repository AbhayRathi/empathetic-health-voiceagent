#!/usr/bin/env node

/**
 * Standalone WebSocket Server for Twilio Media Streams
 * Parses Twilio frames, forwards audio to streaming ASR adapter
 * 
 * Usage: node scripts/websocket-server.js
 */

const WebSocket = require('ws');
const http = require('http');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const PORT = process.env.WS_PORT || 8080;
const API_BASE = process.env.API_BASE || 'http://localhost:3000';

// Create HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('WebSocket server for Twilio Media Streams\n');
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

console.log(`WebSocket server starting on port ${PORT}...`);
console.log(`API base: ${API_BASE}`);
console.log(`Developer mode: ${process.env.DEVELOPER_MODE || 'false'}`);

// Track active connections and their ASR adapters
const connections = new Map();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('sessionId');
  
  console.log(`New WebSocket connection for session: ${sessionId}`);

  if (!sessionId) {
    ws.close(1008, 'Missing sessionId parameter');
    return;
  }

  // Store connection state
  connections.set(sessionId, {
    ws,
    callSid: null,
    streamSid: null,
    startTime: Date.now(),
    audioFrameCount: 0,
    asrAdapter: null,
  });

  // Handle incoming Twilio Media Streams messages
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      const conn = connections.get(sessionId);
      
      switch (message.event) {
        case 'connected':
          console.log(`[${sessionId}] WebSocket connected`);
          break;

        case 'start':
          console.log(`[${sessionId}] Stream started:`, {
            callSid: message.start.callSid,
            streamSid: message.start.streamSid,
            mediaFormat: message.start.mediaFormat,
          });
          
          if (conn) {
            conn.callSid = message.start.callSid;
            conn.streamSid = message.start.streamSid;
            
            // Initialize ASR adapter (would need TypeScript module, using mock for now)
            // In production, this would import StreamingASRAdapter from lib/services
            conn.asrAdapter = {
              isActive: true,
              encoding: message.start.mediaFormat?.encoding || 'audio/x-mulaw',
            };
          }

          // Notify orchestrator that session started
          try {
            await fetch(`${API_BASE}/api/v1/transcript`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                turn: {
                  turn_id: generateId(),
                  call_id: sessionId,
                  speaker: 'agent',
                  text: 'Call session started',
                  start_ms: Date.now(),
                  end_ms: Date.now(),
                  asr_confidence: 1.0,
                  is_final: true,
                },
              }),
            });
          } catch (error) {
            console.error(`[${sessionId}] Error notifying orchestrator:`, error.message);
          }

          // Send mark to acknowledge
          sendMark(ws, message.start.streamSid, 'stream_started');
          break;

        case 'media':
          // Audio frame received from Twilio
          if (conn && conn.asrAdapter && conn.asrAdapter.isActive) {
            conn.audioFrameCount++;
            
            // Extract audio payload (base64 encoded µ-law)
            const audioPayload = message.media.payload;
            const timestamp = message.media.timestamp;
            const track = message.media.track; // 'inbound' or 'outbound'
            
            // Only process inbound audio (patient speaking)
            if (track === 'inbound') {
              // Forward to ASR adapter
              // In production: await conn.asrAdapter.sendAudioFrame(audioPayload, 'mulaw');
              // For now, just log periodically
              if (conn.audioFrameCount % 100 === 0) {
                console.log(`[${sessionId}] Processed ${conn.audioFrameCount} audio frames (${track})`);
              }
            }
          }
          break;

        case 'stop':
          console.log(`[${sessionId}] Stream stopped`);
          
          if (conn && conn.asrAdapter) {
            conn.asrAdapter.isActive = false;
            console.log(`[${sessionId}] Total audio frames: ${conn.audioFrameCount}`);
          }
          
          connections.delete(sessionId);
          break;

        case 'mark':
          // Mark event acknowledged
          console.log(`[${sessionId}] Mark acknowledged:`, message.mark.name);
          break;

        default:
          console.log(`[${sessionId}] Unknown event:`, message.event);
      }
    } catch (error) {
      console.error(`[${sessionId}] Error processing message:`, error);
    }
  });

  ws.on('close', () => {
    console.log(`[${sessionId}] WebSocket closed`);
    connections.delete(sessionId);
  });

  ws.on('error', (error) => {
    console.error(`[${sessionId}] WebSocket error:`, error);
  });
});

// Helper to send mark event
function sendMark(ws, streamSid, name) {
  ws.send(
    JSON.stringify({
      event: 'mark',
      streamSid,
      mark: { name },
    })
  );
}

// Generate unique ID
function generateId() {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Start server
server.listen(PORT, () => {
  console.log(`✓ WebSocket server listening on port ${PORT}`);
  console.log(`  WebSocket endpoint: ws://localhost:${PORT}?sessionId=<session_id>`);
  console.log(`  Use with Twilio Media Streams`);
});

// Handle shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  wss.close(() => {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
});
