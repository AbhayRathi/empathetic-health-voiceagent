# Quick Start Guide

Get the Empathetic Health Voice Agent running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- npm or yarn
- API keys (see below)

## Step 1: Clone and Install

```bash
# Clone the repository
git clone https://github.com/AbhayRathi/empathetic-health-voiceagent.git
cd empathetic-health-voiceagent

# Install dependencies
npm install
```

## Step 2: Get API Keys

You'll need accounts and API keys for:

### Required Services:

1. **Twilio** (for telephony)
   - Sign up at https://www.twilio.com/try-twilio
   - Get Account SID, Auth Token, and purchase a phone number
   - Free trial includes $15 credit

2. **Deepgram** (for speech-to-text)
   - Sign up at https://deepgram.com
   - Create API key from console
   - Free tier includes $200 credit

3. **OpenAI** (for GPT-4)
   - Sign up at https://platform.openai.com
   - Create API key
   - Requires payment method, but usage-based pricing

4. **ElevenLabs** (for text-to-speech)
   - Sign up at https://elevenlabs.io
   - Get API key and voice ID
   - Free tier includes 10,000 characters/month

### Optional:

5. **TwinMind** (for transcript corrections)
   - Contact TwinMind for API access
   - Not required for basic functionality

## Step 3: Configure Environment

```bash
# Copy example environment file
cp .env.example .env.local

# Edit .env.local with your keys
nano .env.local
```

Minimum required configuration:

```env
# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890

# Deepgram
DEEPGRAM_API_KEY=your_deepgram_key_here

# OpenAI
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxx

# ElevenLabs
ELEVENLABS_API_KEY=your_elevenlabs_key_here
ELEVENLABS_VOICE_ID=EXAVITQu4vr4xnSDxMaL

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Step 4: Run the Application

```bash
# Development mode
npm run dev

# The app will be available at:
# http://localhost:3000
```

## Step 5: Test the Application

### Option A: Test the Web Interface

1. Open http://localhost:3000 in your browser
2. Click "Patient Portal" to see the patient interface
3. Click "Staff Dashboard" to see the staff monitoring interface

### Option B: Test with Twilio

1. **Expose local server** (for development):
   ```bash
   # Using ngrok
   ngrok http 3000
   ```

2. **Configure Twilio webhook**:
   - Go to Twilio Console → Phone Numbers
   - Select your phone number
   - Under "Voice Configuration":
     - A call comes in: `https://your-ngrok-url.ngrok.io/api/telephony/incoming` (POST)
     - Status callback: `https://your-ngrok-url.ngrok.io/api/telephony/status` (POST)
   - Save

3. **Make a test call**:
   - Call your Twilio phone number
   - The AI agent should answer and start the intake process

## Common Issues

### "API key not found" errors

**Problem:** Environment variables not loaded

**Solution:**
```bash
# Make sure .env.local exists
ls -la .env.local

# Restart the dev server
npm run dev
```

### Twilio webhook not responding

**Problem:** Local server not accessible from internet

**Solution:**
```bash
# Use ngrok to expose local server
ngrok http 3000

# Update Twilio webhook URL with ngrok URL
```

### Build errors

**Problem:** Dependencies not installed correctly

**Solution:**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

## What's Next?

### Explore the Application

- **Home Page** (`/`): Overview and navigation
- **Patient Portal** (`/patient`): Patient-facing interface
- **Staff Dashboard** (`/staff`): Staff monitoring and management

### Test the APIs

```bash
# Get session details
curl http://localhost:3000/api/sessions/session_123

# Simulate Twilio webhook
curl -X POST http://localhost:3000/api/telephony/incoming \
  -d "CallSid=TEST123" \
  -d "From=+11234567890" \
  -d "To=+10987654321"
```

### Customize

1. **Modify required questions**: Edit `lib/services/session-manager.ts`
2. **Adjust AI prompts**: Edit `lib/services/gpt.ts`
3. **Change voice settings**: Edit `lib/services/elevenlabs.ts`
4. **Update UI**: Edit files in `app/` directory

## Development Workflow

```bash
# Start development server
npm run dev

# Type checking
npm run type-check

# Build for production
npm run build

# Start production server
npm start
```

## Architecture Overview

```
┌─────────────────────┐
│   Patient Calls     │
└──────────┬──────────┘
           │
    ┌──────▼──────┐
    │   Twilio    │ (Telephony)
    └──────┬──────┘
           │
    ┌──────▼──────┐
    │  Next.js    │ (Application)
    │   Server    │
    └──────┬──────┘
           │
    ┌──────▼──────────────────────┐
    │  Service Integrations       │
    ├─────────────────────────────┤
    │ • Deepgram (ASR)           │
    │ • GPT-4 (Dialogue)         │
    │ • ElevenLabs (TTS)         │
    │ • TwinMind (Corrections)   │
    └──────┬──────────────────────┘
           │
    ┌──────▼──────┐
    │  Dashboard  │
    │  (Patient/  │
    │   Staff)    │
    └─────────────┘
```

## Getting Help

- **Documentation**: See [README.md](README.md) for detailed information
- **API Reference**: See [API.md](API.md) for API documentation
- **Deployment**: See [DEPLOYMENT.md](DEPLOYMENT.md) for production setup
- **Issues**: Report bugs on GitHub

## Sample Conversation Flow

Here's what a typical call looks like:

1. **Patient calls** the Twilio number
2. **System answers**: "Hello, thank you for calling. How can I help you today?"
3. **Patient speaks**: "I need to schedule an appointment"
4. **System (GPT-4)**: Processes request, asks required questions
5. **Deepgram**: Transcribes patient responses in real-time
6. **System**: Extracts information, confirms details
7. **ElevenLabs**: Generates natural voice responses
8. **Call ends**: TwinMind corrects transcript, data saved

## Costs (Approximate)

For development/testing:

- Twilio: $1/month (phone number) + usage
- Deepgram: Free tier ($200 credit)
- OpenAI GPT-4: ~$0.03 per conversation
- ElevenLabs: Free tier (10k chars/month)

**Total**: ~$5-10/month for light testing

## Production Considerations

Before going to production:

1. ✅ Complete HIPAA compliance audit
2. ✅ Set up SSL/TLS certificates
3. ✅ Configure production database
4. ✅ Implement authentication
5. ✅ Set up monitoring and logging
6. ✅ Sign BAA with all service providers
7. ✅ Configure backup and disaster recovery
8. ✅ Test at scale

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete production setup guide.

## License

ISC

## Support

For questions or issues:
- Open a GitHub issue
- Check documentation
- Review API reference

---

**Ready to get started?** Run `npm run dev` and visit http://localhost:3000! 🚀
