# MVP Call Loop - Quick Start Guide

## 🚀 Getting Started

This guide will help you run the MVP call loop locally for testing and development.

### Prerequisites

- Node.js 18+
- npm or yarn
- (Optional) Docker and Docker Compose

### Installation

```bash
# Clone and install
git clone https://github.com/AbhayRathi/empathetic-health-voiceagent.git
cd empathetic-health-voiceagent
npm install

# Setup environment
make setup  # Creates .env.local from .env.example
```

### Configuration

#### Developer Mode (No API Keys Required)

For local testing without external API keys:

```bash
# .env.local is already configured for developer mode
DEVELOPER_MODE=true
```

This enables:
- Mock LLM responses (GPT-4 not required)
- Local call simulation
- In-memory session storage
- Synthetic TTS (ElevenLabs not required)

#### Production Mode (With API Keys)

Edit `.env.local` with your real API keys:

```env
DEVELOPER_MODE=false

# Required for production
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
DEEPGRAM_API_KEY=your_deepgram_key
OPENAI_API_KEY=your_openai_key
ELEVENLABS_API_KEY=your_elevenlabs_key
```

### Running the MVP

#### Option 1: Quick Start (Recommended)

```bash
# Terminal 1: Start Next.js dev server
make dev

# Terminal 2 (in another window): Run call simulation
make simulate
```

Open http://localhost:3000/staff to see live updates!

#### Option 2: Full Stack with Docker

```bash
# Start all services (Postgres, Redis, App, WebSocket)
make docker-up

# View logs
make docker-logs

# Stop all services
make docker-down
```

#### Option 3: Manual Control

```bash
# Start Next.js
npm run dev

# In another terminal: Start WebSocket server
make ws-server

# In another terminal: Run simulator
node scripts/simulate-call.js
```

## 📊 Testing Scenarios

### Normal Intake Conversation

Simulates a complete 7-question intake flow:

```bash
make simulate
```

Expected output:
- Session created with unique call_id
- 7 questions asked (full_name, dob, callback_number, etc.)
- Answers collected with confidence scores
- Final snapshot with all fields filled

### Red Flag Detection

Tests emergency safety detection:

```bash
make simulate-red-flag
```

Expected behavior:
- Detects "chest pain + can't breathe" pattern
- Immediately requests handoff
- Priority set to "urgent"
- Red flag logged in snapshot

### Manual API Testing

```bash
# Create a session and send transcript
curl -X POST http://localhost:3000/api/v1/transcript \
  -H "Content-Type: application/json" \
  -d '{
    "turn": {
      "turn_id": "test_1",
      "call_id": "manual_test",
      "speaker": "patient",
      "text": "My name is Jane Doe",
      "start_ms": 1000,
      "end_ms": 2000,
      "asr_confidence": 0.92,
      "is_final": true
    }
  }'

# Get snapshot
curl http://localhost:3000/api/v1/emit_snapshot?call_id=manual_test
```

## 🎯 Acceptance Criteria Verification

### ✅ Acceptance 1: Simulated Call → Orchestrator → LLM → Snapshot

```bash
make simulate
# ✓ Check: snapshot contains first question asked
# ✓ Check: evidence turn_id is present
```

### ✅ Acceptance 2: Answer Processing → Snapshot Update → TTS

```bash
make simulate
# ✓ Check: Each patient answer triggers snapshot update
# ✓ Check: Confidence >= 0.6 for filled status
# ✓ Check: TTS request logged (or mock in dev mode)
```

### ✅ Acceptance 3: Red Flag → Handoff

```bash
make simulate-red-flag
# ✓ Check: "request_handoff" event logged
# ✓ Check: Urgent priority set
# ✓ Check: Intake stops after red flag
```

### ✅ Acceptance 4: Staff Dashboard Live Updates

```bash
# Terminal 1
make dev

# Terminal 2
make simulate

# Browser: Open http://localhost:3000/staff
# ✓ Check: Live transcript appears in real-time
# ✓ Check: Snapshot updates as slots fill
# ✓ Check: SSE connection indicator shows "Connected"
```

### ✅ Acceptance 5: No Secrets in Repo

```bash
git log --all -p | grep -i "sk-" || echo "✓ No OpenAI keys found"
git log --all -p | grep -i "AC[a-z0-9]" || echo "✓ No Twilio SIDs found"
# ✓ Check: Only .env.example exists with REDACTED values
```

## 🔧 Development Commands

```bash
make help              # Show all available commands
make install           # Install dependencies
make dev               # Start Next.js dev server
make build             # Build production bundle
make type-check        # Run TypeScript checks
make simulate          # Run normal call simulation
make simulate-red-flag # Run red flag scenario
make ws-server         # Start WebSocket server
make docker-up         # Start Docker stack
make docker-down       # Stop Docker stack
make clean             # Clean build artifacts
```

## 📁 Project Structure

```
empathetic-health-voiceagent/
├── app/
│   ├── api/
│   │   └── v1/                    # Orchestrator API endpoints
│   │       ├── transcript/        # POST transcript turns
│   │       ├── emit_snapshot/     # POST/GET snapshots
│   │       ├── request_handoff/   # POST handoff requests
│   │       └── live/              # GET SSE stream
│   └── staff/
│       └── page.tsx               # Live dashboard UI
├── lib/
│   ├── orchestrator/
│   │   ├── index.ts               # Main orchestrator
│   │   ├── slot-engine.ts         # Question/slot management
│   │   └── safety.ts              # Red flag detection
│   ├── services/
│   │   ├── orchestrator-gpt.ts    # LLM with function calling
│   │   ├── deepgram.ts            # ASR integration
│   │   ├── elevenlabs.ts          # TTS integration
│   │   └── twilio.ts              # Telephony
│   └── types/
│       └── index.ts               # TypeScript definitions
├── scripts/
│   ├── simulate-call.js           # Call simulator
│   └── websocket-server.js        # WS server for Twilio
├── shared/
│   └── schemas/
│       └── intake.questions.json  # Question definitions
├── docker-compose.yml             # Docker stack
├── Dockerfile                     # Container image
├── Makefile                       # Dev commands
└── .env.example                   # Environment template
```

## 🏗️ Architecture

### Call Flow

```
Patient Call
    ↓
Twilio Media Streams (WebSocket)
    ↓
Deepgram Streaming ASR
    ↓
[Orchestrator]
    ├─ Receives transcript turns
    ├─ Safety red flag check
    ├─ Slot engine (next question)
    └─ Calls LLM with function calling
         ↓
    LLM Function Calls:
         ├─ emit_snapshot(snapshot)
         ├─ speak(ssml, emotion)
         └─ request_handoff(reason)
              ↓
         ElevenLabs TTS
              ↓
         Twilio (back to call)
```

### SSE Event Flow

```
Orchestrator Events → /api/v1/live → Staff Dashboard

Event Types:
- session_started
- transcript_received
- snapshot_updated
- red_flag_detected
- handoff_requested
- intake_completed
- session_ended
```

## 🔒 HIPAA Compliance Notes

**Current MVP Implementation:**
- ✅ Minimal PHI retention (only required fields)
- ✅ No raw audio storage by default
- ✅ Secrets via environment variables
- ✅ Audit event logging structure
- ⚠️ **NOT PRODUCTION-READY** - Missing:
  - Database encryption at rest
  - TLS/SSL certificates
  - BAA agreements with providers
  - Access control authentication
  - Secure session management

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Kill process on port 3000
pkill -f "next dev"

# Or use different port
PORT=3001 npm run dev
```

### WebSocket Connection Failed

```bash
# Ensure WebSocket server is running
make ws-server

# Check if port 8080 is free
lsof -i :8080
```

### SSE Not Connecting in Browser

```bash
# Check if API endpoint is responding
curl http://localhost:3000/api/v1/live?call_id=test

# Check browser console for errors
# Open DevTools → Network → EventStream
```

### Type Errors

```bash
# Clean and reinstall
make clean
npm install
npm run type-check
```

## 📝 Next Steps

1. **Add Authentication** - Implement JWT or OAuth for staff dashboard
2. **Persistent Storage** - Switch from in-memory to Postgres
3. **Real Twilio Integration** - Deploy and configure Twilio webhooks
4. **Production Monitoring** - Add APM, error tracking, logging
5. **BAA Agreements** - Obtain BAAs from all PHI-handling providers

## 🙏 Support

For issues and questions:
1. Check existing GitHub issues
2. Review documentation in `/docs`
3. Open a new issue with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node version)

---

**Built with** ❤️ **for better patient experiences**
