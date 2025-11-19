# Transcription Setup Guide

This guide explains how to set up and run the end-to-end transcription pipeline for the Empathetic Health Voice Agent MVP.

## Architecture Overview

The transcription pipeline consists of:

1. **Twilio Media Streams** → WebSocket server receives audio frames
2. **Streaming ASR** → Deepgram processes audio in real-time, emits partials/finals
3. **Orchestrator** → Receives transcript turns, updates IntakeSnapshot, broadcasts via SSE
4. **TwinMind (Post-Call)** → High-accuracy correction with speaker diarization

## Quick Start (Developer Mode)

Run the entire pipeline in mock mode **without API keys**:

```bash
# 1. Install dependencies
make install

# 2. Copy environment template
cp .env.example .env.local

# 3. Enable developer mode (edit .env.local)
DEVELOPER_MODE=true

# 4. Start the Next.js server
make dev
# (in another terminal)

# 5. Run smoke tests
make smoke-test
```

All external services (Deepgram, TwinMind, Twilio, ElevenLabs) will use mock implementations.

## Production Setup

### Required API Keys

1. **Deepgram** (Streaming ASR)
   - Sign up: https://deepgram.com
   - Get API key from console
   - Add to `.env.local`: `DEEPGRAM_API_KEY=your_key_here`

2. **TwinMind** (High-Accuracy Post-Processing)
   - Contact TwinMind for API access
   - Confirm BAA (Business Associate Agreement) for PHI processing
   - Add to `.env.local`:
     ```
     TWINMIND_API_KEY=your_key_here
     TWINMIND_BASE_URL=https://api.twinmind.dev
     TWINMIND_MODEL=ear-3-pro
     ```

3. **Twilio** (Telephony)
   - Sign up: https://twilio.com
   - Add to `.env.local`:
     ```
     TWILIO_ACCOUNT_SID=your_sid
     TWILIO_AUTH_TOKEN=your_token
     TWILIO_PHONE_NUMBER=+1234567890
     TWILIO_AUTH_SECRET=your_webhook_secret
     ```

4. **OpenAI** (LLM Orchestration)
   - Get API key from https://platform.openai.com
   - Add to `.env.local`: `OPENAI_API_KEY=your_key_here`

5. **ElevenLabs** (Text-to-Speech)
   - Get API key from https://elevenlabs.io
   - Add to `.env.local`:
     ```
     ELEVENLABS_API_KEY=your_key_here
     ELEVENLABS_VOICE_ID=your_voice_id
     ```

### Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
# Required for production
DEEPGRAM_API_KEY=your_deepgram_key
TWINMIND_API_KEY=your_twinmind_key
OPENAI_API_KEY=your_openai_key
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
ELEVENLABS_API_KEY=your_elevenlabs_key

# Optional tuning
TWINMIND_MAX_RPM=60          # Rate limit: requests per minute
TWINMIND_MAX_RPD=1000        # Rate limit: requests per day
TWINMIND_MODEL=ear-3-pro     # TwinMind model

# Application
NEXT_PUBLIC_APP_URL=https://your-domain.com
API_BASE=https://your-domain.com
WS_PORT=8080

# Developer mode (set to false for production)
DEVELOPER_MODE=false
```

## Running the Transcription Pipeline

### 1. Start Services

```bash
# Terminal 1: Next.js API server
npm run dev

# Terminal 2: WebSocket server (for Twilio Media Streams)
make ws-server
```

### 2. Simulate a Call (Development)

```bash
# Send simulated transcript turns to the API
make simulate

# Test red flag detection
make simulate-red-flag
```

### 3. Live Call Flow (Production)

**Incoming Call:**
1. Twilio receives call → sends webhook to `/api/telephony/incoming`
2. TwiML response connects call to WebSocket server
3. WebSocket server:
   - Receives Twilio Media Streams (µ-law audio)
   - Forwards to Streaming ASR Adapter
4. Streaming ASR Adapter:
   - Converts µ-law → PCM
   - Streams to Deepgram
   - Receives partials/finals
   - POSTs to `/api/v1/transcript`
5. Orchestrator:
   - Processes transcript turns
   - Updates IntakeSnapshot
   - Emits SSE events to staff dashboard
6. Post-Call (TwinMind):
   - Chunks audio (30-120s segments)
   - Submits async jobs to TwinMind
   - Polls for completion
   - Computes diffs vs live transcript
   - Merges corrections into IntakeSnapshot
   - Emits `twinmind_correction` SSE event

### 4. Monitor Live Updates

Staff dashboard listens to SSE stream:

```javascript
const eventSource = new EventSource('/api/v1/live?call_id=<call_id>');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'partial':
      // Show interim transcript
      console.log('Partial:', data.data.turn.text);
      break;
    case 'final':
      // Update final transcript
      console.log('Final:', data.data.turn.text);
      break;
    case 'snapshot_update':
      // Refresh intake form
      console.log('Snapshot updated:', data.data.snapshot);
      break;
    case 'red_flag':
      // Alert staff
      console.log('RED FLAG:', data.data.flags);
      break;
    case 'twinmind_correction':
      // Show corrections
      console.log('Correction:', data.data.diffs);
      break;
    case 'tts_playback':
      // Track agent speech
      console.log('Agent speaking:', data.data.ssml);
      break;
  }
};
```

## API Endpoints

### POST `/api/v1/transcript`

Submit a transcript turn (from ASR):

```json
{
  "turn": {
    "turn_id": "uuid",
    "call_id": "string",
    "speaker": "patient|agent",
    "text": "string",
    "start_ms": 0,
    "end_ms": 1000,
    "asr_confidence": 0.9,
    "is_final": true,
    "metadata": {
      "provider": "deepgram",
      "model": "nova-2"
    }
  }
}
```

### GET `/api/v1/live?call_id=<id>`

Server-Sent Events stream for live updates. Event types:
- `partial` - Interim transcript
- `final` - Final transcript turn
- `snapshot_update` - IntakeSnapshot updated
- `red_flag` - Safety issue detected
- `twinmind_correction` - Post-call correction
- `tts_playback` - Agent speech

### GET `/api/v1/transcript?call_id=<id>`

Get all transcript turns for a call.

### POST `/api/v1/emit_snapshot`

Manually emit an IntakeSnapshot update.

### POST `/api/v1/request_handoff`

Request human handoff (safety escalation).

## Testing

### Smoke Tests

```bash
# Requires dev server running in another terminal
make smoke-test
```

Tests:
1. Live transcription (partials & finals)
2. SSE event delivery
3. Turn persistence
4. TwinMind mock mode
5. Red flag detection

### Manual Testing

```bash
# 1. Start dev server
npm run dev

# 2. Send test transcript
curl -X POST http://localhost:3000/api/v1/transcript \
  -H "Content-Type: application/json" \
  -d '{
    "turn": {
      "turn_id": "test_1",
      "call_id": "test_call",
      "speaker": "patient",
      "text": "I need to see a doctor",
      "start_ms": 0,
      "end_ms": 1000,
      "asr_confidence": 0.95,
      "is_final": true
    }
  }'

# 3. Listen to SSE
curl -N http://localhost:3000/api/v1/live?call_id=test_call
```

## Troubleshooting

### "DEEPGRAM_API_KEY not set"
- Add key to `.env.local` OR
- Set `DEVELOPER_MODE=true` to use mock ASR

### "TwinMind rate limit exceeded"
- Check `TWINMIND_MAX_RPM` and `TWINMIND_MAX_RPD`
- Worker will automatically retry with exponential backoff

### "WebSocket connection failed"
- Ensure `make ws-server` is running
- Check `WS_PORT` in `.env.local`
- Verify firewall allows port 8080

### SSE events not received
- Check browser console for CORS errors
- Verify `NEXT_PUBLIC_APP_URL` matches your domain
- Test with `curl -N http://localhost:3000/api/v1/live?call_id=test`

## Security & Compliance

### PHI Protection

- **Raw Audio**: Default retention OFF. If enabled, TTL + encryption required.
- **Transcripts**: Stored in memory by default. For DB persistence, enable encryption.
- **API Keys**: NEVER commit to repo. Use environment variables only.
- **BAA Requirements**: Confirm BAA with TwinMind before processing real PHI.

### Environment Variables

Add to GitHub Secrets (for CI/CD):
- `TWINMIND_API_KEY`
- `DEEPGRAM_API_KEY`
- `TWILIO_AUTH_TOKEN`
- `OPENAI_API_KEY`
- `ELEVENLABS_API_KEY`

### Mock Mode Safety

`DEVELOPER_MODE=true` ensures:
- No real API calls to external providers
- No PHI leaves the system
- Safe for local development without API keys

## Performance Tuning

### Deepgram

- Model: `nova-2` (fast, accurate)
- Interim results: Enabled for real-time feel
- Endpointing: 300ms for natural pauses

### TwinMind

- Chunk size: 30-120 seconds (balance accuracy vs latency)
- Rate limits: 60 RPM, 1000 RPD (configurable)
- Polling interval: 2s initial, 10s max (exponential backoff)

### SSE

- Keep-alive: 30s ping
- Reconnection: Client-side with Last-Event-ID
- Buffer: Last 50 events for reconnection replay (TODO)

## Next Steps

1. **Add Event Buffer**: Implement last-N events replay in `/api/v1/live`
2. **Database Persistence**: Add Postgres tables for calls, turns, snapshots
3. **Audio Chunking**: Implement TwinMind worker for post-call processing
4. **Staff Dashboard UI**: Build React components for live monitoring
5. **Metrics**: Add latency tracking and error monitoring

## Support

For questions or issues:
- GitHub Issues: https://github.com/AbhayRathi/empathetic-health-voiceagent/issues
- Documentation: See `QUICKSTART_MVP.md` for general setup

---

**Last Updated**: 2025-11-19
**Version**: MVP v1.0
