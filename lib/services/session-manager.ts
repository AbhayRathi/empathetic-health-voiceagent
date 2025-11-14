import {
  VoiceSession,
  TranscriptEntry,
  PatientIntakeSnapshot,
  RequiredQuestion,
  ConfirmedAnswer,
  GPTMessage,
} from '../types';
import { DeepgramService } from './deepgram';
import { GPTService } from './gpt';
import { ElevenLabsService } from './elevenlabs';
import { TwinMindService } from './twinmind';

export class SessionManager {
  private deepgram: DeepgramService;
  private gpt: GPTService;
  private elevenlabs: ElevenLabsService;
  private twinmind: TwinMindService;
  private sessions: Map<string, VoiceSession>;
  private conversationHistory: Map<string, GPTMessage[]>;

  constructor() {
    this.deepgram = new DeepgramService();
    this.gpt = new GPTService();
    this.elevenlabs = new ElevenLabsService();
    this.twinmind = new TwinMindService();
    this.sessions = new Map();
    this.conversationHistory = new Map();
  }

  /**
   * Create a new voice session
   */
  createSession(callSid: string, phoneNumber: string): VoiceSession {
    const session: VoiceSession = {
      id: this.generateSessionId(),
      phoneNumber,
      callSid,
      status: 'active',
      startTime: new Date(),
      transcript: [],
      snapshot: this.initializeSnapshot(),
    };

    this.sessions.set(session.id, session);
    this.conversationHistory.set(session.id, []);
    
    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): VoiceSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Process incoming audio and generate response
   */
  async processAudio(
    sessionId: string,
    audioChunk: Buffer,
    onResponse: (audio: Buffer, text: string) => void
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Transcription happens via WebSocket in real implementation
    // This is a simplified flow
  }

  /**
   * Process transcript and generate AI response
   */
  async processTranscript(
    sessionId: string,
    transcriptText: string,
    isFinal: boolean
  ): Promise<{ responseText: string; responseAudio: Buffer }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Add to transcript
    const entry: TranscriptEntry = {
      timestamp: new Date(),
      speaker: 'patient',
      text: transcriptText,
      isFinal,
    };
    session.transcript.push(entry);

    // Only process final transcripts for responses
    if (!isFinal) {
      return { responseText: '', responseAudio: Buffer.from([]) };
    }

    // Update conversation history
    const history = this.conversationHistory.get(sessionId) || [];
    history.push({
      role: 'user',
      content: transcriptText,
    });

    // Get required questions
    const requiredQuestions = this.getRequiredQuestions();

    // Generate AI response
    const gptResponse = await this.gpt.generateResponse(
      history,
      session.snapshot,
      requiredQuestions
    );

    // Add assistant response to history
    history.push({
      role: 'assistant',
      content: gptResponse.message,
    });
    this.conversationHistory.set(sessionId, history);

    // Add to transcript
    session.transcript.push({
      timestamp: new Date(),
      speaker: 'agent',
      text: gptResponse.message,
      isFinal: true,
    });

    // Generate speech
    const audioBuffer = await this.elevenlabs.textToSpeech(gptResponse.message);

    // Update snapshot
    await this.updateSnapshot(sessionId, transcriptText);

    return {
      responseText: gptResponse.message,
      responseAudio: audioBuffer,
    };
  }

  /**
   * Update patient intake snapshot
   */
  private async updateSnapshot(sessionId: string, newTranscript: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Extract information from conversation
    const fullTranscript = session.transcript
      .map(t => `${t.speaker}: ${t.text}`)
      .join('\n');

    try {
      const extractedInfo = await this.gpt.extractInformation(fullTranscript);
      
      // Merge extracted info into snapshot
      if (extractedInfo.personalInfo) {
        session.snapshot.personalInfo = {
          ...session.snapshot.personalInfo,
          ...extractedInfo.personalInfo,
        };
      }

      if (extractedInfo.medicalInfo) {
        session.snapshot.medicalInfo = {
          ...session.snapshot.medicalInfo,
          ...extractedInfo.medicalInfo,
        };
      }

      if (extractedInfo.visitReason) {
        session.snapshot.visitReason = extractedInfo.visitReason;
      }

      session.snapshot.rawTranscript = fullTranscript;
      session.snapshot.timestamp = new Date();
      session.snapshot.version += 1;
    } catch (error) {
      console.error('Failed to update snapshot:', error);
    }
  }

  /**
   * End session and perform post-call processing
   */
  async endSession(sessionId: string): Promise<VoiceSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.status = 'completed';
    session.endTime = new Date();

    // Perform TwinMind correction on final transcript
    const fullTranscript = session.transcript
      .map(t => t.text)
      .join(' ');

    try {
      const correction = await this.twinmind.correctTranscript(
        sessionId,
        fullTranscript,
        session.audioRecordingUrl
      );

      // Update snapshot with corrected transcript
      session.snapshot.rawTranscript = correction.correctedTranscript;
      console.log(`TwinMind correction applied with ${correction.corrections.length} corrections`);
    } catch (error) {
      console.error('TwinMind correction failed:', error);
    }

    return session;
  }

  /**
   * Get current snapshot for a session
   */
  getSnapshot(sessionId: string): PatientIntakeSnapshot | undefined {
    const session = this.sessions.get(sessionId);
    return session?.snapshot;
  }

  /**
   * Initialize empty snapshot
   */
  private initializeSnapshot(): PatientIntakeSnapshot {
    return {
      sessionId: '',
      timestamp: new Date(),
      personalInfo: {},
      medicalInfo: {
        symptoms: [],
        allergies: [],
        medications: [],
        medicalHistory: [],
      },
      requiredQuestions: this.getRequiredQuestions(),
      confirmedAnswers: new Map(),
      rawTranscript: '',
      version: 1,
    };
  }

  /**
   * Get required questions for intake
   */
  private getRequiredQuestions(): RequiredQuestion[] {
    return [
      {
        id: 'q1',
        question: 'What is your full name?',
        verbatim: 'What is your full name?',
        asked: false,
        answered: false,
        category: 'personal',
        required: true,
      },
      {
        id: 'q2',
        question: 'What is your date of birth?',
        verbatim: 'What is your date of birth?',
        asked: false,
        answered: false,
        category: 'personal',
        required: true,
      },
      {
        id: 'q3',
        question: 'What brings you in today?',
        verbatim: 'What brings you in today?',
        asked: false,
        answered: false,
        category: 'visit',
        required: true,
      },
      {
        id: 'q4',
        question: 'Do you have any allergies to medications?',
        verbatim: 'Do you have any allergies to medications?',
        asked: false,
        answered: false,
        category: 'medical',
        required: true,
      },
      {
        id: 'q5',
        question: 'What medications are you currently taking?',
        verbatim: 'What medications are you currently taking?',
        asked: false,
        answered: false,
        category: 'medical',
        required: true,
      },
    ];
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
