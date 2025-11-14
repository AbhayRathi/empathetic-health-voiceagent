# Empathetic Health Voice Agent

A HIPAA-compliant AI-powered voice intake system for healthcare that combines telephony, real-time transcription, empathetic dialogue, and comprehensive patient dashboards.

## 🎯 Features

- **📞 Telephony Integration**: Twilio/Telnyx support for inbound/outbound calls
- **🎙️ Real-time Transcription**: Deepgram streaming ASR for live speech-to-text
- **🤖 Empathetic AI Dialogue**: GPT-4.1/4o powered conversational engine
- **🔊 Natural Text-to-Speech**: ElevenLabs for human-like voice responses
- **📝 High-Accuracy Corrections**: TwinMind Ear-3 Pro for post-call transcript refinement
- **📊 Patient Dashboard**: User-friendly portal for accessing session history
- **👨‍⚕️ Staff Dashboard**: Real-time monitoring and management interface
- **🔒 HIPAA Compliance**: Secure design with encryption and audit logging
- **✅ Verbatim Questions**: Required questions asked exactly as specified
- **💾 JSON Snapshots**: Real-time structured data extraction

## 🏗️ Architecture

```
┌─────────────┐
│   Patient   │
└──────┬──────┘
       │ Phone Call
       ▼
┌─────────────────────────────────────┐
│      Twilio/Telnyx Telephony        │
└──────┬──────────────────────────────┘
       │ WebSocket Audio Stream
       ▼
┌─────────────────────────────────────┐
│    Deepgram Streaming ASR           │
│    (Real-time Transcription)        │
└──────┬──────────────────────────────┘
       │ Transcript
       ▼
┌─────────────────────────────────────┐
│    GPT-4 Dialogue Engine            │
│    (Empathetic Conversation)        │
└──────┬──────────────────────────────┘
       │ Response Text
       ▼
┌─────────────────────────────────────┐
│    ElevenLabs TTS                   │
│    (Natural Voice)                  │
└──────┬──────────────────────────────┘
       │ Audio Response
       ▼
┌─────────────────────────────────────┐
│    Next.js Application              │
│    • Session Manager                │
│    • Patient Dashboard              │
│    • Staff Dashboard                │
│    • Real-time JSON Snapshots       │
└─────────────────────────────────────┘
       │ Post-Call
       ▼
┌─────────────────────────────────────┐
│    TwinMind Ear-3 Pro               │
│    (Transcript Correction)          │
└─────────────────────────────────────┘
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Twilio or Telnyx account
- API keys for:
  - Deepgram
  - OpenAI (GPT-4)
  - ElevenLabs
  - TwinMind (optional)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/AbhayRathi/empathetic-health-voiceagent.git
cd empathetic-health-voiceagent
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Edit `.env.local` with your API credentials:
```env
# Telephony (choose one)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_number

# ASR & Transcription
DEEPGRAM_API_KEY=your_deepgram_key
TWINMIND_API_KEY=your_twinmind_key

# LLM
OPENAI_API_KEY=your_openai_key

# TTS
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_VOICE_ID=your_voice_id

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
empathetic-health-voiceagent/
├── app/
│   ├── api/
│   │   ├── telephony/        # Twilio webhook endpoints
│   │   └── sessions/         # Session management APIs
│   ├── patient/              # Patient portal
│   ├── staff/                # Staff dashboard
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── services/
│   │   ├── deepgram.ts       # Deepgram ASR integration
│   │   ├── gpt.ts            # GPT-4 dialogue engine
│   │   ├── elevenlabs.ts     # ElevenLabs TTS
│   │   ├── twinmind.ts       # TwinMind corrections
│   │   ├── twilio.ts         # Twilio telephony
│   │   └── session-manager.ts # Orchestration
│   └── types/
│       └── index.ts          # TypeScript definitions
├── components/               # React components
└── public/                   # Static assets
```

## 🔧 Configuration

### Twilio Setup

1. Create a Twilio account and purchase a phone number
2. Configure webhook URL for incoming calls:
   - Voice & Fax → Configure → Webhook URL: `https://your-domain.com/api/telephony/incoming`
3. Set up status callbacks: `https://your-domain.com/api/telephony/status`

### Deepgram Setup

1. Sign up for Deepgram account
2. Create API key from dashboard
3. Add to `.env.local`

### OpenAI Setup

1. Get API key from OpenAI platform
2. Ensure GPT-4 access is enabled
3. Add to `.env.local`

### ElevenLabs Setup

1. Create ElevenLabs account
2. Get API key and choose a voice ID
3. Add credentials to `.env.local`

## 🔒 HIPAA Compliance

This system implements HIPAA-safe design patterns:

- **Encryption**: All data encrypted at rest and in transit
- **Access Controls**: Role-based access to PHI
- **Audit Logging**: All access to PHI is logged
- **Data Retention**: Configurable retention policies
- **Patient Consent**: Built-in consent management
- **Secure Communication**: TLS/SSL for all connections

**Note**: Full HIPAA compliance requires additional infrastructure setup including BAA agreements with service providers.

## 📊 API Endpoints

### Telephony

- `POST /api/telephony/incoming` - Webhook for incoming calls
- `POST /api/telephony/status` - Call status callbacks
- `GET /api/telephony/incoming?CallSid={sid}` - Get call details

### Sessions

- `GET /api/sessions/{id}` - Get session details and snapshot
- `POST /api/sessions/{id}` - End a session

## 🎨 Dashboards

### Patient Portal (`/patient`)

- View session history
- Access transcripts
- Review collected information
- HIPAA-compliant data access

### Staff Dashboard (`/staff`)

- Real-time session monitoring
- Patient information review
- Transcript analysis
- System metrics

## 🧪 Testing

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Build
npm run build
```

## 🚢 Deployment

### Production Build

```bash
npm run build
npm start
```

### Environment Variables

Ensure all production environment variables are set:
- Use production URLs for webhooks
- Enable SSL/TLS
- Configure secure database
- Set up monitoring and logging

### Recommended Platforms

- Vercel (recommended for Next.js)
- AWS with ECS/EKS
- Google Cloud Run
- Azure App Service

## 📝 License

ISC

## 🤝 Contributing

Contributions are welcome! Please ensure:
1. Code follows TypeScript best practices
2. HIPAA compliance is maintained
3. All changes are tested
4. Documentation is updated

## 📧 Support

For issues and questions, please open a GitHub issue.

## 🙏 Acknowledgments

- Twilio for telephony infrastructure
- Deepgram for real-time ASR
- OpenAI for GPT-4 dialogue capabilities
- ElevenLabs for natural TTS
- TwinMind for high-accuracy corrections
