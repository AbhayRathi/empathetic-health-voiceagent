#!/usr/bin/env node

/**
 * Standalone WebSocket Server for Twilio Media Streams
 * Run this alongside the Next.js app for production WebSocket support
 * 
 * Usage: node scripts/websocket-server.js
 */

const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.WS_PORT || 8080;

// Create HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('WebSocket server for Twilio Media Streams\n');
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

console.log(`WebSocket server starting on port ${PORT}...`);

// Track active connections
const connections = new Map();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('sessionId');
  
  console.log(`New WebSocket connection for session: ${sessionId}`);

  if (!sessionId) {
    ws.close(1008, 'Missing sessionId parameter');
    return;
  }

  // Store connection
  connections.set(sessionId, {
    ws,
    callSid: null,
    streamSid: null,
    startTime: Date.now(),
  });

  // Handle incoming messages
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.event) {
        case 'connected':
          console.log(`[${sessionId}] WebSocket connected`);
          break;

        case 'start':
          console.log(`[${sessionId}] Stream started:`, {
            callSid: message.start.callSid,
            streamSid: message.start.streamSid,
          });
          
          const conn = connections.get(sessionId);
          if (conn) {
            conn.callSid = message.start.callSid;
            conn.streamSid = message.start.streamSid;
          }

          // Send to Next.js API to initialize session
          await fetch(`http://localhost:3000/api/v1/transcript`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              turn: {
                turn_id: generateId(),
                call_id: sessionId,
                speaker: 'agent',
                text: 'Session started',
                start_ms: Date.now(),
                end_ms: Date.now(),
                asr_confidence: 1.0,
                is_final: true,
              },
            }),
          });

          // Send initial greeting (mock)
          sendMark(ws, message.start.streamSid, 'greeting_sent');
          break;

        case 'media':
          // Audio frame received
          // In production, forward to Deepgram
          // For now, just log periodically
          if (Math.random() < 0.001) {
            console.log(`[${sessionId}] Receiving audio frames...`);
          }
          break;

        case 'stop':
          console.log(`[${sessionId}] Stream stopped`);
          connections.delete(sessionId);
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
