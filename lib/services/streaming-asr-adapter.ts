import { createClient, LiveTranscriptionEvents, LiveClient } from '@deepgram/sdk';
import { TranscriptTurn } from '../types';

/**
 * Streaming ASR Adapter
 * Maintains persistent WebSocket connection to Deepgram (or other ASR provider)
 * Converts audio frames, forwards to ASR, and posts results to orchestrator
 */
export class StreamingASRAdapter {
  private apiKey: string;
  private client: any;
  private connection: LiveClient | null = null;
  private callId: string;
  private onTranscriptCallback: (turn: TranscriptTurn) => Promise<void>;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnected = false;
  private isDeveloperMode: boolean;
  private turnSequence = 0;
  private audioStartTime: number = Date.now();

  constructor(
    callId: string,
    onTranscript: (turn: TranscriptTurn) => Promise<void>,
    options?: {
      apiKey?: string;
      developerMode?: boolean;
    }
  ) {
    this.callId = callId;
    this.onTranscriptCallback = onTranscript;
    this.isDeveloperMode = options?.developerMode || process.env.DEVELOPER_MODE === 'true';
    this.apiKey = options?.apiKey || process.env.DEEPGRAM_API_KEY || '';

    if (!this.isDeveloperMode && !this.apiKey) {
      console.warn('DEEPGRAM_API_KEY not set and DEVELOPER_MODE is false. Falling back to mock mode.');
      this.isDeveloperMode = true;
    }

    if (!this.isDeveloperMode) {
      this.client = createClient(this.apiKey);
    }
  }

  /**
   * Start streaming connection to ASR provider
   */
  async start(): Promise<void> {
    if (this.isDeveloperMode) {
      console.log(`[ASR Mock] Starting mock ASR for call ${this.callId}`);
      this.isConnected = true;
      return;
    }

    try {
      console.log(`[ASR] Starting Deepgram connection for call ${this.callId}`);
      
      this.connection = this.client.listen.live({
        model: 'nova-2',
        language: 'en-US',
        smart_format: true,
        punctuate: true,
        interim_results: true,
        endpointing: 300,
        utterance_end_ms: 1000,
        encoding: 'linear16',
        sample_rate: 16000,
        channels: 1,
      });

      this.setupEventHandlers();
      this.isConnected = true;
      this.reconnectAttempts = 0;
    } catch (error) {
      console.error('[ASR] Failed to start connection:', error);
      await this.handleReconnect();
    }
  }

  /**
   * Setup event handlers for Deepgram connection
   */
  private setupEventHandlers(): void {
    if (!this.connection) return;

    this.connection.on(LiveTranscriptionEvents.Open, () => {
      console.log(`[ASR] Connection opened for call ${this.callId}`);
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.connection.on(LiveTranscriptionEvents.Transcript, async (data) => {
      try {
        const transcript = data.channel?.alternatives?.[0]?.transcript;
        const confidence = data.channel?.alternatives?.[0]?.confidence || 0;
        const isFinal = data.is_final || false;
        const words = data.channel?.alternatives?.[0]?.words || [];

        if (transcript && transcript.length > 0) {
          const startMs = words.length > 0 ? Math.floor(words[0].start * 1000) : 0;
          const endMs = words.length > 0 
            ? Math.floor(words[words.length - 1].end * 1000) 
            : startMs + transcript.split(' ').length * 200;

          const turn: TranscriptTurn = {
            turn_id: `turn_${this.callId}_${++this.turnSequence}`,
            call_id: this.callId,
            speaker: 'patient',
            text: transcript,
            start_ms: startMs,
            end_ms: endMs,
            asr_confidence: confidence,
            is_final: isFinal,
          };

          await this.onTranscriptCallback(turn);
        }
      } catch (error) {
        console.error('[ASR] Error processing transcript:', error);
      }
    });

    this.connection.on(LiveTranscriptionEvents.Error, async (error) => {
      console.error('[ASR] Connection error:', error);
      this.isConnected = false;
      await this.handleReconnect();
    });

    this.connection.on(LiveTranscriptionEvents.Close, async () => {
      console.log('[ASR] Connection closed');
      this.isConnected = false;
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        await this.handleReconnect();
      }
    });
  }

  /**
   * Handle reconnection with exponential backoff
   */
  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[ASR] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`[ASR] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    await this.start();
  }

  /**
   * Send audio frame to ASR
   * Handles µ-law to PCM conversion if needed
   */
  async sendAudioFrame(audioData: Buffer | string, encoding?: 'mulaw' | 'pcm'): Promise<void> {
    if (this.isDeveloperMode) {
      // Mock mode: simulate transcript generation
      if (Math.random() < 0.1) { // 10% chance to emit a mock partial
        const mockPhrases = [
          'I need to see a doctor',
          'My name is John Smith',
          'I have a headache',
          'I\'m allergic to penicillin',
        ];
        const turn: TranscriptTurn = {
          turn_id: `turn_${this.callId}_${++this.turnSequence}`,
          call_id: this.callId,
          speaker: 'patient',
          text: mockPhrases[Math.floor(Math.random() * mockPhrases.length)],
          start_ms: Date.now() - this.audioStartTime,
          end_ms: Date.now() - this.audioStartTime + 1000,
          asr_confidence: 0.9,
          is_final: Math.random() < 0.3,
        };
        await this.onTranscriptCallback(turn);
      }
      return;
    }

    if (!this.isConnected || !this.connection) {
      console.warn('[ASR] Not connected, skipping audio frame');
      return;
    }

    try {
      let pcmData: Buffer;

      if (encoding === 'mulaw') {
        // Convert µ-law to linear PCM 16-bit
        pcmData = this.convertMuLawToPCM(
          typeof audioData === 'string' ? Buffer.from(audioData, 'base64') : audioData
        );
      } else {
        pcmData = typeof audioData === 'string' ? Buffer.from(audioData, 'base64') : audioData;
      }

      this.connection.send(pcmData);
    } catch (error) {
      console.error('[ASR] Error sending audio frame:', error);
    }
  }

  /**
   * Convert µ-law encoded audio to linear PCM
   * Twilio Media Streams uses µ-law encoding
   */
  private convertMuLawToPCM(mulawData: Buffer): Buffer {
    const pcmData = Buffer.alloc(mulawData.length * 2);
    
    const mulawToLinear = [
      -32124, -31100, -30076, -29052, -28028, -27004, -25980, -24956,
      -23932, -22908, -21884, -20860, -19836, -18812, -17788, -16764,
      -15996, -15484, -14972, -14460, -13948, -13436, -12924, -12412,
      -11900, -11388, -10876, -10364, -9852, -9340, -8828, -8316,
      -7932, -7676, -7420, -7164, -6908, -6652, -6396, -6140,
      -5884, -5628, -5372, -5116, -4860, -4604, -4348, -4092,
      -3900, -3772, -3644, -3516, -3388, -3260, -3132, -3004,
      -2876, -2748, -2620, -2492, -2364, -2236, -2108, -1980,
      -1884, -1820, -1756, -1692, -1628, -1564, -1500, -1436,
      -1372, -1308, -1244, -1180, -1116, -1052, -988, -924,
      -876, -844, -812, -780, -748, -716, -684, -652,
      -620, -588, -556, -524, -492, -460, -428, -396,
      -372, -356, -340, -324, -308, -292, -276, -260,
      -244, -228, -212, -196, -180, -164, -148, -132,
      -120, -112, -104, -96, -88, -80, -72, -64,
      -56, -48, -40, -32, -24, -16, -8, 0,
      32124, 31100, 30076, 29052, 28028, 27004, 25980, 24956,
      23932, 22908, 21884, 20860, 19836, 18812, 17788, 16764,
      15996, 15484, 14972, 14460, 13948, 13436, 12924, 12412,
      11900, 11388, 10876, 10364, 9852, 9340, 8828, 8316,
      7932, 7676, 7420, 7164, 6908, 6652, 6396, 6140,
      5884, 5628, 5372, 5116, 4860, 4604, 4348, 4092,
      3900, 3772, 3644, 3516, 3388, 3260, 3132, 3004,
      2876, 2748, 2620, 2492, 2364, 2236, 2108, 1980,
      1884, 1820, 1756, 1692, 1628, 1564, 1500, 1436,
      1372, 1308, 1244, 1180, 1116, 1052, 988, 924,
      876, 844, 812, 780, 748, 716, 684, 652,
      620, 588, 556, 524, 492, 460, 428, 396,
      372, 356, 340, 324, 308, 292, 276, 260,
      244, 228, 212, 196, 180, 164, 148, 132,
      120, 112, 104, 96, 88, 80, 72, 64,
      56, 48, 40, 32, 24, 16, 8, 0,
    ];

    for (let i = 0; i < mulawData.length; i++) {
      const sample = mulawToLinear[mulawData[i]];
      pcmData.writeInt16LE(sample, i * 2);
    }

    return pcmData;
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    if (this.isDeveloperMode) {
      console.log(`[ASR Mock] Closing mock ASR for call ${this.callId}`);
      this.isConnected = false;
      return;
    }

    if (this.connection) {
      try {
        console.log(`[ASR] Closing connection for call ${this.callId}`);
        this.connection.finish();
        this.isConnected = false;
      } catch (error) {
        console.error('[ASR] Error closing connection:', error);
      }
    }
  }

  /**
   * Check if connected
   */
  getIsConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get connection metrics
   */
  getMetrics(): {
    reconnectAttempts: number;
    isConnected: boolean;
    turnsProcessed: number;
  } {
    return {
      reconnectAttempts: this.reconnectAttempts,
      isConnected: this.isConnected,
      turnsProcessed: this.turnSequence,
    };
  }
}
