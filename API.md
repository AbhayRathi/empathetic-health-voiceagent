# API Documentation

## Overview

The Empathetic Health Voice Agent provides REST APIs for telephony integration, session management, and data retrieval.

## Base URL

```
Development: http://localhost:3000
Production: https://your-domain.com
```

## Authentication

Currently, the API endpoints are designed for webhook integration and do not require authentication. In production, implement:

- API keys for programmatic access
- JWT tokens for dashboard access
- Webhook signature validation (Twilio)

## Endpoints

### Telephony

#### Incoming Call Webhook

Handles incoming calls from Twilio.

**Endpoint:** `POST /api/telephony/incoming`

**Request (Form Data):**
```
CallSid: string
From: string (E.164 format phone number)
To: string (E.164 format phone number)
CallStatus: string
```

**Response:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://your-domain.com/api/websocket?sessionId={id}" />
  </Connect>
</Response>
```

**Example cURL:**
```bash
curl -X POST https://your-domain.com/api/telephony/incoming \
  -d "CallSid=CA123456" \
  -d "From=+12345678900" \
  -d "To=+10987654321" \
  -d "CallStatus=in-progress"
```

---

#### Call Status Callback

Receives call status updates from Twilio.

**Endpoint:** `POST /api/telephony/status`

**Request (Form Data):**
```
CallSid: string
CallStatus: string (queued|ringing|in-progress|completed|busy|failed|no-answer|canceled)
RecordingUrl?: string
```

**Response:**
```json
{
  "success": true
}
```

---

#### Get Call Details

Retrieve details about a specific call.

**Endpoint:** `GET /api/telephony/incoming?CallSid={sid}`

**Query Parameters:**
- `CallSid` (required): The Twilio Call SID

**Response:**
```json
{
  "sid": "CA123456",
  "from": "+12345678900",
  "to": "+10987654321",
  "status": "completed",
  "duration": "325",
  "startTime": "2024-01-15T10:30:00Z",
  "endTime": "2024-01-15T10:35:25Z"
}
```

---

### Sessions

#### Get Session

Retrieve complete session data including transcript and snapshot.

**Endpoint:** `GET /api/sessions/{id}`

**URL Parameters:**
- `id`: Session ID

**Response:**
```json
{
  "session": {
    "id": "session_1234567890_abc123",
    "status": "completed",
    "startTime": "2024-01-15T10:30:00Z",
    "endTime": "2024-01-15T10:35:25Z",
    "phoneNumber": "+12345678900"
  },
  "snapshot": {
    "sessionId": "session_1234567890_abc123",
    "timestamp": "2024-01-15T10:35:25Z",
    "personalInfo": {
      "name": "John Doe",
      "dateOfBirth": "01/15/1980",
      "phoneNumber": "+12345678900",
      "email": "john@example.com"
    },
    "medicalInfo": {
      "chiefComplaint": "Persistent headache",
      "symptoms": ["headache", "dizziness"],
      "allergies": ["penicillin"],
      "medications": ["ibuprofen"],
      "medicalHistory": []
    },
    "visitReason": "Follow-up appointment for headaches",
    "requiredQuestions": [...],
    "confirmedAnswers": {},
    "rawTranscript": "...",
    "version": 3
  },
  "transcript": [
    {
      "timestamp": "2024-01-15T10:30:05Z",
      "speaker": "agent",
      "text": "Hello, thank you for calling. How can I help you today?",
      "isFinal": true
    },
    {
      "timestamp": "2024-01-15T10:30:12Z",
      "speaker": "patient",
      "text": "I've been having persistent headaches.",
      "confidence": 0.95,
      "isFinal": true
    }
  ]
}
```

**Error Response:**
```json
{
  "error": "Session not found"
}
```

**Status Codes:**
- 200: Success
- 404: Session not found
- 500: Server error

---

#### End Session

Manually end an active session and trigger post-processing.

**Endpoint:** `POST /api/sessions/{id}`

**URL Parameters:**
- `id`: Session ID

**Response:**
```json
{
  "success": true,
  "session": {
    "id": "session_1234567890_abc123",
    "status": "completed",
    "endTime": "2024-01-15T10:35:25Z"
  }
}
```

**Status Codes:**
- 200: Success
- 404: Session not found
- 500: Server error

---

## Data Models

### VoiceSession

```typescript
interface VoiceSession {
  id: string;
  patientId?: string;
  phoneNumber: string;
  callSid: string;
  status: 'active' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  transcript: TranscriptEntry[];
  snapshot: PatientIntakeSnapshot;
  audioRecordingUrl?: string;
}
```

### TranscriptEntry

```typescript
interface TranscriptEntry {
  timestamp: Date;
  speaker: 'agent' | 'patient';
  text: string;
  confidence?: number;
  isFinal: boolean;
}
```

### PatientIntakeSnapshot

```typescript
interface PatientIntakeSnapshot {
  sessionId: string;
  timestamp: Date;
  personalInfo: {
    name?: string;
    dateOfBirth?: string;
    phoneNumber?: string;
    email?: string;
    address?: string;
  };
  medicalInfo: {
    chiefComplaint?: string;
    symptoms?: string[];
    allergies?: string[];
    medications?: string[];
    medicalHistory?: string[];
  };
  visitReason?: string;
  requiredQuestions: RequiredQuestion[];
  confirmedAnswers: Map<string, ConfirmedAnswer>;
  rawTranscript: string;
  version: number;
}
```

### RequiredQuestion

```typescript
interface RequiredQuestion {
  id: string;
  question: string;
  verbatim: string;
  asked: boolean;
  answered: boolean;
  category: 'personal' | 'medical' | 'visit';
  required: true;
}
```

---

## WebSocket API

### Connection

Connect to the WebSocket endpoint for real-time audio streaming:

```
wss://your-domain.com/api/websocket?sessionId={id}
```

### Events

#### Client → Server

**Audio Data:**
```json
{
  "type": "audio",
  "data": "base64-encoded-audio"
}
```

**Control Messages:**
```json
{
  "type": "control",
  "action": "pause" | "resume" | "end"
}
```

#### Server → Client

**Transcript Update:**
```json
{
  "type": "transcript",
  "speaker": "patient" | "agent",
  "text": "...",
  "isFinal": boolean,
  "confidence": number
}
```

**Agent Response:**
```json
{
  "type": "response",
  "text": "...",
  "audio": "base64-encoded-audio"
}
```

**Snapshot Update:**
```json
{
  "type": "snapshot",
  "snapshot": { ... }
}
```

**Error:**
```json
{
  "type": "error",
  "message": "Error description"
}
```

---

## Rate Limits

- API requests: 100 requests per minute per IP
- WebSocket connections: 10 concurrent connections per IP
- Telephony: Based on Twilio account limits

Exceeding rate limits returns:
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```

---

## Error Handling

All errors follow this format:

```json
{
  "error": "Error description",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional context"
  }
}
```

### Common Error Codes

- `INVALID_REQUEST`: Malformed request
- `SESSION_NOT_FOUND`: Session ID doesn't exist
- `AUTHENTICATION_FAILED`: Invalid credentials
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `SERVICE_UNAVAILABLE`: Downstream service failure

---

## Webhooks

### Twilio Configuration

Configure these URLs in your Twilio phone number settings:

**Voice Configuration:**
- A Call Comes In: `https://your-domain.com/api/telephony/incoming` (HTTP POST)
- Status Callback: `https://your-domain.com/api/telephony/status` (HTTP POST)

**Recording Configuration:**
- Recording Status Callback: `https://your-domain.com/api/telephony/recording` (HTTP POST)

---

## SDK Examples

### JavaScript/TypeScript

```typescript
// Get session data
async function getSession(sessionId: string) {
  const response = await fetch(`/api/sessions/${sessionId}`);
  const data = await response.json();
  return data;
}

// End session
async function endSession(sessionId: string) {
  const response = await fetch(`/api/sessions/${sessionId}`, {
    method: 'POST'
  });
  const data = await response.json();
  return data;
}
```

### Python

```python
import requests

# Get session data
def get_session(session_id):
    response = requests.get(f"https://your-domain.com/api/sessions/{session_id}")
    return response.json()

# End session
def end_session(session_id):
    response = requests.post(f"https://your-domain.com/api/sessions/{session_id}")
    return response.json()
```

---

## Testing

### Test Endpoints

Use these endpoints for testing:

```bash
# Simulate incoming call
curl -X POST http://localhost:3000/api/telephony/incoming \
  -d "CallSid=TEST123" \
  -d "From=+11234567890" \
  -d "To=+10987654321"

# Get session
curl http://localhost:3000/api/sessions/session_test_123

# End session
curl -X POST http://localhost:3000/api/sessions/session_test_123
```

---

## Changelog

### v1.0.0 (2024-01-15)
- Initial API release
- Telephony webhook endpoints
- Session management APIs
- WebSocket support for audio streaming
