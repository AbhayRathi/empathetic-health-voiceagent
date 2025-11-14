import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { Readable } from 'stream';

export class ElevenLabsService {
  private client: ElevenLabsClient;
  private voiceId: string;

  constructor() {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY is required');
    }
    this.client = new ElevenLabsClient({ apiKey });
    this.voiceId = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'; // Default: Sarah voice
  }

  /**
   * Convert text to speech and return audio stream
   */
  async textToSpeech(text: string): Promise<Buffer> {
    try {
      const audioStream = await this.client.textToSpeech.convert(this.voiceId, {
        text,
        modelId: 'eleven_turbo_v2',
      });

      // Convert stream to buffer
      const chunks: Buffer[] = [];
      
      if (audioStream instanceof Readable) {
        for await (const chunk of audioStream) {
          chunks.push(Buffer.from(chunk));
        }
      }

      return Buffer.concat(chunks);
    } catch (error) {
      console.error('ElevenLabs TTS error:', error);
      throw new Error('Failed to generate speech');
    }
  }

  /**
   * Convert text to speech and return as base64 audio
   */
  async textToSpeechBase64(text: string): Promise<string> {
    const audioBuffer = await this.textToSpeech(text);
    return audioBuffer.toString('base64');
  }

  /**
   * Stream text to speech for real-time playback
   */
  async *streamTextToSpeech(text: string): AsyncGenerator<Buffer> {
    try {
      const audioStream = await this.client.textToSpeech.convert(this.voiceId, {
        text,
        modelId: 'eleven_turbo_v2',
      });

      if (audioStream instanceof Readable) {
        for await (const chunk of audioStream) {
          yield Buffer.from(chunk);
        }
      }
    } catch (error) {
      console.error('ElevenLabs streaming TTS error:', error);
      throw new Error('Failed to stream speech');
    }
  }

  /**
   * Get available voices
   */
  async getVoices() {
    try {
      const voices = await this.client.voices.getAll();
      return voices.voices;
    } catch (error) {
      console.error('Failed to fetch voices:', error);
      throw error;
    }
  }
}
