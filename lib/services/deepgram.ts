import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { TranscriptEntry } from '../types';

export class DeepgramService {
  private client;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.DEEPGRAM_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('DEEPGRAM_API_KEY is required');
    }
    this.client = createClient(this.apiKey);
  }

  /**
   * Create a live transcription connection
   * Returns connection object for streaming audio
   */
  async createLiveTranscription(
    onTranscript: (entry: TranscriptEntry) => void,
    onError: (error: Error) => void
  ) {
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
   * Transcribe pre-recorded audio file
   */
  async transcribeFile(audioBuffer: Buffer): Promise<string> {
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
