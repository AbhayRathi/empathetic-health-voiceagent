// Session types
export interface VoiceSession {
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

export interface TranscriptEntry {
  timestamp: Date;
  speaker: 'agent' | 'patient';
  text: string;
  confidence?: number;
  isFinal: boolean;
}

// Patient intake snapshot
export interface PatientIntakeSnapshot {
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

export interface RequiredQuestion {
  id: string;
  question: string;
  verbatim: string; // Exact verbatim text that must be asked
  asked: boolean;
  answered: boolean;
  category: 'personal' | 'medical' | 'visit';
  required: true;
}

export interface ConfirmedAnswer {
  questionId: string;
  answer: string;
  confirmed: boolean;
  confirmationAttempts: number;
  timestamp: Date;
}

// TwinMind correction
export interface TwinMindCorrection {
  sessionId: string;
  originalTranscript: string;
  correctedTranscript: string;
  corrections: Correction[];
  confidence: number;
  processedAt: Date;
}

export interface Correction {
  position: number;
  original: string;
  corrected: string;
  confidence: number;
}

// API response types
export interface DeepgramResponse {
  channel: {
    alternatives: Array<{
      transcript: string;
      confidence: number;
      words?: Array<{
        word: string;
        start: number;
        end: number;
        confidence: number;
      }>;
    }>;
  };
  is_final: boolean;
  speech_final: boolean;
}

export interface GPTMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GPTResponse {
  message: string;
  shouldConfirm?: boolean;
  questionId?: string;
  extractedInfo?: Partial<PatientIntakeSnapshot>;
}

export interface ElevenLabsConfig {
  voiceId: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
}

// HIPAA compliance
export interface HIPAALog {
  timestamp: Date;
  action: 'access' | 'modify' | 'delete' | 'export';
  userId: string;
  resourceType: 'session' | 'patient' | 'transcript';
  resourceId: string;
  ipAddress: string;
  successful: boolean;
}

// MVP Call Loop Types

// IntakeSnapshot schema (HIPAA-compliant, minimal PHI)
export interface IntakeSnapshot {
  call_id: string;
  patient?: {
    full_name?: string;
    dob?: string; // ISO date format
    callback_number?: string;
  };
  answers: Record<string, SlotAnswer>;
  red_flags: string[];
  completed: boolean;
  timestamp: string; // ISO date-time format
}

export interface SlotAnswer {
  value?: any;
  confidence: number;
  status: 'filled' | 'unknown' | 'not_applicable';
  evidence_turn_ids: string[];
}

// Transcript Turn object
export interface TranscriptTurn {
  turn_id: string;
  call_id: string;
  speaker: 'patient' | 'agent';
  text: string;
  start_ms: number;
  end_ms: number;
  asr_confidence: number;
  is_final?: boolean;
  entities?: Entity[];
  redactions?: Redaction[];
}

export interface Entity {
  type: string; // e.g., 'dob', 'medication', 'symptom'
  value: string;
  confidence: number;
}

export interface Redaction {
  type: string; // e.g., 'phone', 'ssn', 'address'
  offset: number;
  length: number;
}

// LLM Function/Tool Schemas
export interface LLMFunctionCall {
  name: 'emit_snapshot' | 'request_handoff' | 'speak';
  arguments: Record<string, any>;
}

export interface EmitSnapshotArgs {
  snapshot: IntakeSnapshot;
}

export interface RequestHandoffArgs {
  call_id: string;
  reason: string;
  priority?: 'urgent' | 'high' | 'normal';
}

export interface SpeakArgs {
  ssml: string;
  emotion?: 'calm' | 'concerned' | 'encouraging';
}

// Orchestrator request/response types
export interface TranscriptRequest {
  turn: TranscriptTurn;
}

export interface SnapshotRequest {
  snapshot: IntakeSnapshot;
}

export interface HandoffRequest {
  call_id: string;
  reason: string;
  priority?: 'urgent' | 'high' | 'normal';
}

// Slot Engine types
export interface IntakeQuestion {
  id: string;
  verbatim: string;
  slot: string;
  category: 'personal' | 'medical' | 'visit';
  required: boolean;
  validation?: {
    type: 'string' | 'date' | 'boolean' | 'array';
    format?: string;
  };
}

export interface SlotEngineState {
  call_id: string;
  questions: IntakeQuestion[];
  current_question_index: number;
  snapshot: IntakeSnapshot;
  turns: TranscriptTurn[];
}

// Safety detection types
export interface RedFlagRule {
  tokens: string[][];
  reason: string;
  priority: 'urgent' | 'high' | 'normal';
}

// Twilio Media Streams types
export interface TwilioMediaMessage {
  event: 'connected' | 'start' | 'media' | 'stop';
  sequenceNumber?: string;
  streamSid?: string;
  media?: {
    track: 'inbound' | 'outbound';
    chunk: string; // base64 encoded audio
    timestamp: string;
    payload: string; // base64 µ-law audio
  };
  start?: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string[];
    mediaFormat: {
      encoding: string;
      sampleRate: number;
      channels: number;
    };
  };
  stop?: {
    streamSid: string;
    accountSid: string;
    callSid: string;
  };
}

// TwinMind API types
export interface TwinMindJob {
  job_id: string;
  call_id: string;
  chunk_id: string;
  chunk_path?: string;
  audio_duration_seconds?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  twin_job_id?: string;
  created_at: string;
  completed_at?: string;
  error?: string;
}

export interface TwinMindSegment {
  speaker_label: string; // e.g., 'speaker_0', 'speaker_1'
  text: string;
  start_seconds: number;
  end_seconds: number;
  confidence: number;
}

export interface TwinMindCorrectionEvent {
  call_id: string;
  chunk_id: string;
  twinmind_job_id: string;
  diffs: TwinMindDiff[];
  timestamp: string; // ISO8601
}

export interface TwinMindDiff {
  live_turn_id: string;
  twin_text: string;
  diff_type: 'modified' | 'added' | 'removed';
  fields_changed: string[]; // e.g., ['medication', 'allergy', 'dob']
}
