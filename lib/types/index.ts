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
