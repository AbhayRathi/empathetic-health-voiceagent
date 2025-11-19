import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { Readable } from 'stream';

export class ElevenLabsService {
  private client: ElevenLabsClient | null = null;
  private voiceId: string;
  private isDeveloperMode: boolean;

  constructor() {
    this.isDeveloperMode = process.env.DEVELOPER_MODE === 'true';
    const apiKey = process.env.ELEVENLABS_API_KEY;
    
    if (!this.isDeveloperMode && !apiKey) {
      console.warn('ELEVENLABS_API_KEY not set and DEVELOPER_MODE is false. Falling back to mock mode.');
      this.isDeveloperMode = true;
    }

    if (!this.isDeveloperMode && apiKey) {
      this.client = new ElevenLabsClient({ apiKey });
    }

    this.voiceId = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'; // Default: Sarah voice
  }

  /**
   * Convert text to speech and return audio stream
   */
  async textToSpeech(text: string): Promise<Buffer> {
    if (this.isDeveloperMode) {
      return this.textToSpeechMock(text);
    }

    if (!this.client) {
      throw new Error('ElevenLabs client not initialized');
    }

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
   * Mock TTS for developer mode
   */
  private async textToSpeechMock(text: string): Promise<Buffer> {
    console.log(`[ElevenLabs Mock] TTS request: "${text.substring(0, 50)}..."`);
    
    // Return empty audio buffer (in real scenario, could return silent audio)
    const sampleRate = 16000;
    const duration = Math.max(text.length * 0.05, 1); // ~50ms per character
    const samples = Math.floor(sampleRate * duration);
    const buffer = Buffer.alloc(samples * 2); // 16-bit samples

    // Fill with silence (zeros)
    buffer.fill(0);

    return buffer;
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
    if (this.isDeveloperMode) {
      // Mock streaming
      const buffer = await this.textToSpeechMock(text);
      yield buffer;
      return;
    }

    if (!this.client) {
      throw new Error('ElevenLabs client not initialized');
    }

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
    if (this.isDeveloperMode) {
      return [
        { voice_id: 'mock_voice_1', name: 'Mock Sarah', category: 'mock' },
        { voice_id: 'mock_voice_2', name: 'Mock John', category: 'mock' },
      ];
    }

    if (!this.client) {
      throw new Error('ElevenLabs client not initialized');
    }

    try {
      const voices = await this.client.voices.getAll();
      return voices.voices;
    } catch (error) {
      console.error('Failed to fetch voices:', error);
      throw error;
    }
  }
}
