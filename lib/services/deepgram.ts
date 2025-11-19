import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { TranscriptEntry } from '../types';

export class DeepgramService {
  private client: any;
  private apiKey: string;
  private isDeveloperMode: boolean;

  constructor() {
    this.isDeveloperMode = process.env.DEVELOPER_MODE === 'true';
    this.apiKey = process.env.DEEPGRAM_API_KEY || '';
    
    if (!this.isDeveloperMode && !this.apiKey) {
      console.warn('DEEPGRAM_API_KEY not set and DEVELOPER_MODE is false. Falling back to mock mode.');
      this.isDeveloperMode = true;
    }

    if (!this.isDeveloperMode) {
      this.client = createClient(this.apiKey);
    }
  }

  /**
   * Create a live transcription connection
   * Returns connection object for streaming audio
   */
  async createLiveTranscription(
    onTranscript: (entry: TranscriptEntry) => void,
    onError: (error: Error) => void
  ) {
    if (this.isDeveloperMode) {
      return this.createMockConnection(onTranscript);
    }

    try {
      const connection = this.client.listen.live({
        model: 'nova-2',
        language: 'en-US',
        smart_format: true,
        punctuate: true,
        interim_results: true,
        endpointing: 300,
        utterance_end_ms: 1000,
      });

      connection.on(LiveTranscriptionEvents.Open, () => {
        console.log('Deepgram connection opened');
      });

      connection.on(LiveTranscriptionEvents.Transcript, (data) => {
        const transcript = data.channel?.alternatives?.[0]?.transcript;
        const confidence = data.channel?.alternatives?.[0]?.confidence || 0;
        const isFinal = data.is_final || false;

        if (transcript && transcript.length > 0) {
          const entry: TranscriptEntry = {
            timestamp: new Date(),
            speaker: 'patient',
            text: transcript,
            confidence,
            isFinal,
          };
          onTranscript(entry);
        }
      });

      connection.on(LiveTranscriptionEvents.Error, (error) => {
        console.error('Deepgram error:', error);
        onError(new Error('Deepgram transcription error'));
      });

      connection.on(LiveTranscriptionEvents.Close, () => {
        console.log('Deepgram connection closed');
      });

      return connection;
    } catch (error) {
      console.error('Failed to create Deepgram connection:', error);
      throw error;
    }
  }

  /**
   * Create mock connection for developer mode
   */
  private createMockConnection(onTranscript: (entry: TranscriptEntry) => void) {
    console.log('[Deepgram Mock] Creating mock transcription connection');

    const mockPhrases = [
      'Hello, how can I help you today?',
      'My name is John Smith',
      'I was born on January 1st, 1990',
      'I\'m here for a checkup',
      'No, I don\'t have any allergies',
    ];

    let phraseIndex = 0;
    let isOpen = false;

    const mockConnection = {
      send: (data: any) => {
        // Mock: emit a transcript every few frames
        if (Math.random() < 0.05 && isOpen) {
          const phrase = mockPhrases[phraseIndex % mockPhrases.length];
          
          const entry: TranscriptEntry = {
            timestamp: new Date(),
            speaker: 'patient',
            text: phrase,
            confidence: 0.90 + Math.random() * 0.09,
            isFinal: Math.random() < 0.3,
          };

          onTranscript(entry);
          
          if (entry.isFinal) {
            phraseIndex++;
          }
        }
      },
      finish: () => {
        console.log('[Deepgram Mock] Connection closed');
        isOpen = false;
      },
      getReadyState: () => (isOpen ? 1 : 3), // 1 = OPEN, 3 = CLOSED
    };

    // Simulate connection opening
    setTimeout(() => {
      isOpen = true;
      console.log('[Deepgram Mock] Connection opened');
    }, 100);

    return mockConnection;
  }

  /**
   * Transcribe pre-recorded audio file
   */
  async transcribeFile(audioBuffer: Buffer): Promise<string> {
    if (this.isDeveloperMode) {
      console.log(`[Deepgram Mock] Transcribing ${audioBuffer.length} bytes of audio`);
      return 'Mock transcription of pre-recorded audio file. This is a placeholder transcript generated in developer mode.';
    }

    try {
      const { result } = await this.client.listen.prerecorded.transcribeFile(
        audioBuffer,
        {
          model: 'nova-2',
          smart_format: true,
          punctuate: true,
        }
      );

      const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript;
      return transcript || '';
    } catch (error) {
      console.error('Deepgram file transcription error:', error);
      throw error;
    }
  }
}
