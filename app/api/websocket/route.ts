import { NextRequest } from 'next/server';
import { TwilioMediaMessage } from '@/lib/types';
import { Orchestrator } from '@/lib/orchestrator';
import { DeepgramService } from '@/lib/services/deepgram';
import { ElevenLabsService } from '@/lib/services/elevenlabs';
import { OrchestratorGPT } from '@/lib/services/orchestrator-gpt';

// Global instances
let orchestratorInstance: Orchestrator | null = null;

function getOrchestrator(): Orchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new Orchestrator();
  }
  return orchestratorInstance;
}

/**
 * WebSocket handler for Twilio Media Streams
 * Handles bidirectional audio streaming for voice calls
 * 
 * Note: Next.js doesn't natively support WebSocket routes in production.
 * This is a simplified implementation for local development.
 * For production, use a separate WebSocket server or Vercel's edge functions.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return new Response('Missing sessionId parameter', { status: 400 });
  }

  // In production, this would upgrade to WebSocket
  // For now, return instructions for setting up WebSocket server
  return new Response(
    JSON.stringify({
      message: 'WebSocket endpoint for Twilio Media Streams',
      sessionId,
      note: 'In production, this requires a dedicated WebSocket server. See /scripts/websocket-server.ts',
      endpoints: {
        ws: `wss://${request.headers.get('host')}/api/websocket?sessionId=${sessionId}`,
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * WebSocket Server Implementation
 * This would be run as a separate process in production
 */
export class TwilioWebSocketHandler {
  private orchestrator: Orchestrator;
  private deepgramService: DeepgramService | null = null;
  private elevenlabsService: ElevenLabsService | null = null;
  private gptService: OrchestratorGPT | null = null;
  private callSessions: Map<string, CallSession> = new Map();

  constructor() {
    this.orchestrator = getOrchestrator();
    
    // Initialize services if API keys are available
    try {
      if (process.env.DEEPGRAM_API_KEY) {
        this.deepgramService = new DeepgramService();
      }
    } catch (e) {
      console.warn('Deepgram service not available:', e);
    }

    try {
      if (process.env.ELEVENLABS_API_KEY) {
        this.elevenlabsService = new ElevenLabsService();
      }
    } catch (e) {
      console.warn('ElevenLabs service not available:', e);
    }

    try {
      this.gptService = new OrchestratorGPT();
    } catch (e) {
      console.warn('GPT service not available:', e);
    }
  }

  /**
   * Handle incoming Twilio Media Stream message
   */
  async handleMessage(ws: any, message: TwilioMediaMessage, callId: string): Promise<void> {
    switch (message.event) {
      case 'connected':
        console.log(`WebSocket connected for call ${callId}`);
        break;

      case 'start':
        if (message.start) {
          await this.handleStreamStart(ws, message.start, callId);
        }
        break;

      case 'media':
        if (message.media) {
          await this.handleMediaFrame(ws, message.media, callId);
        }
        break;

      case 'stop':
        if (message.stop) {
          await this.handleStreamStop(callId);
        }
        break;

      default:
        console.log(`Unknown event: ${message.event}`);
    }
  }

  /**
   * Handle stream start
   */
  private async handleStreamStart(
    ws: any,
    start: NonNullable<TwilioMediaMessage['start']>,
    callId: string
  ): Promise<void> {
    console.log(`Stream started for call ${start.callSid}`);

    // Initialize orchestrator session
    const state = this.orchestrator.initializeSession(callId);

    // Create Deepgram connection if available
    let deepgramConnection = null;
    if (this.deepgramService) {
      try {
        deepgramConnection = await this.deepgramService.createLiveTranscription(
          async (entry) => {
            // Forward transcript to orchestrator
            const turn = {
              turn_id: this.generateTurnId(),
              call_id: callId,
              speaker: 'patient' as const,
              text: entry.text,
              start_ms: Date.now(),
              end_ms: Date.now(),
              asr_confidence: entry.confidence || 0,
              is_final: entry.isFinal,
            };

            // Send to orchestrator
            const action = await this.orchestrator.processTranscript(turn);

            // Handle orchestrator action
            if (action.action === 'ask_question' && this.gptService) {
              await this.handleQuestionAction(ws, action.data, callId);
            } else if (action.action === 'request_handoff') {
              await this.handleHandoffAction(ws, action.data);
            } else if (action.action === 'speak') {
              await this.speakToCall(ws, action.data.ssml, callId);
            }
          },
          (error) => {
            console.error('Deepgram error:', error);
          }
        );
      } catch (error) {
        console.error('Failed to create Deepgram connection:', error);
      }
    }

    // Store session
    this.callSessions.set(callId, {
      callSid: start.callSid,
      streamSid: start.streamSid,
      deepgramConnection,
      conversationHistory: [],
    });

    // Send initial greeting
    await this.speakToCall(
      ws,
      'Hello! Thank you for calling. I\'m here to help with your medical intake. Let\'s get started.',
      callId
    );

    // Ask first question
    const nextQuestion = state.questions[0];
    if (nextQuestion) {
      await this.speakToCall(ws, nextQuestion.verbatim, callId);
    }
  }

  /**
   * Handle media frame (audio chunk)
   */
  private async handleMediaFrame(
    ws: any,
    media: NonNullable<TwilioMediaMessage['media']>,
    callId: string
  ): Promise<void> {
    const session = this.callSessions.get(callId);
    if (!session || !session.deepgramConnection) {
      return;
    }

    // Decode µ-law audio from base64
    const audioBuffer = Buffer.from(media.payload, 'base64');

    // Send to Deepgram
    try {
      session.deepgramConnection.send(audioBuffer);
    } catch (error) {
      console.error('Error sending audio to Deepgram:', error);
    }
  }

  /**
   * Handle stream stop
   */
  private async handleStreamStop(callId: string): Promise<void> {
    console.log(`Stream stopped for call ${callId}`);

    const session = this.callSessions.get(callId);
    if (session) {
      // Close Deepgram connection
      if (session.deepgramConnection) {
        session.deepgramConnection.finish();
      }

      // End orchestrator session
      this.orchestrator.endSession(callId);

      // Clean up
      this.callSessions.delete(callId);
    }
  }

  /**
   * Handle question action from orchestrator
   */
  private async handleQuestionAction(
    ws: any,
    data: any,
    callId: string
  ): Promise<void> {
    const session = this.callSessions.get(callId);
    if (!session || !this.gptService) {
      return;
    }

    const state = this.orchestrator.getSession(callId);
    if (!state) {
      return;
    }

    // Call LLM to generate empathetic question
    const result = await this.gptService.callLLM(
      state,
      data.question,
      session.conversationHistory
    );

    // Process function calls if any
    if (result.functionCalls) {
      for (const funcCall of result.functionCalls) {
        await this.orchestrator.processFunctionCall(callId, funcCall);

        // If it's a speak function, execute it
        if (funcCall.name === 'speak') {
          await this.speakToCall(ws, funcCall.arguments.ssml, callId);
        }
      }
    } else if (result.response) {
      // Fallback to direct response
      await this.speakToCall(ws, result.response, callId);
    }

    // Update conversation history
    session.conversationHistory.push({
      role: 'assistant',
      content: result.response,
    });
  }

  /**
   * Handle handoff action
   */
  private async handleHandoffAction(ws: any, data: any): Promise<void> {
    const message = `I need to transfer you to a staff member immediately. ${
      data.priority === 'urgent'
        ? 'If this is a medical emergency, please hang up and call 911.'
        : 'Please hold while I connect you.'
    }`;

    await this.speakToCall(ws, message, data.call_id);
  }

  /**
   * Speak text to call via TTS
   */
  private async speakToCall(ws: any, text: string, callId: string): Promise<void> {
    if (!this.elevenlabsService) {
      console.warn('ElevenLabs not available, cannot speak to call');
      return;
    }

    try {
      // Generate TTS audio
      const audioBuffer = await this.elevenlabsService.textToSpeech(text);

      // Convert to µ-law and send to Twilio
      // Note: In production, you'd convert PCM to µ-law format
      // For now, we'll send a mark event
      const session = this.callSessions.get(callId);
      if (session) {
        ws.send(
          JSON.stringify({
            event: 'mark',
            streamSid: session.streamSid,
            mark: {
              name: 'audio_playback',
            },
          })
        );

        console.log(`Spoke to call ${callId}: ${text.substring(0, 50)}...`);
      }
    } catch (error) {
      console.error('Error speaking to call:', error);
    }
  }

  /**
   * Generate unique turn ID
   */
  private generateTurnId(): string {
    return `turn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

interface CallSession {
  callSid: string;
  streamSid: string;
  deepgramConnection: any;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
}
