import {
  IntakeSnapshot,
  SlotEngineState,
  TranscriptTurn,
  IntakeQuestion,
  LLMFunctionCall,
  EmitSnapshotArgs,
  RequestHandoffArgs,
  SpeakArgs,
} from '../types';
import { SlotEngine } from './slot-engine';
import { SafetyDetector } from './safety';

/**
 * Orchestrator
 * Coordinates the full call loop: ASR → Slot Engine → LLM → TTS
 * Maintains state, handles safety checks, and broadcasts updates
 */
export class Orchestrator {
  private slotEngine: SlotEngine;
  private safetyDetector: SafetyDetector;
  private sessions: Map<string, SlotEngineState>;
  private snapshots: Map<string, IntakeSnapshot>;
  private eventListeners: Map<string, Array<(event: OrchestratorEvent) => void>>;

  constructor() {
    this.slotEngine = new SlotEngine();
    this.safetyDetector = new SafetyDetector();
    this.sessions = new Map();
    this.snapshots = new Map();
    this.eventListeners = new Map();
  }

  /**
   * Initialize a new call session
   */
  initializeSession(callId: string): SlotEngineState {
    const state = this.slotEngine.initializeState(callId);
    this.sessions.set(callId, state);
    this.snapshots.set(callId, state.snapshot);

    this.emitEvent({
      type: 'session_started',
      call_id: callId,
      timestamp: new Date().toISOString(),
      data: { state },
    });

    return state;
  }

  /**
   * Get session state
   */
  getSession(callId: string): SlotEngineState | undefined {
    return this.sessions.get(callId);
  }

  /**
   * Get current snapshot
   */
  getSnapshot(callId: string): IntakeSnapshot | undefined {
    return this.snapshots.get(callId);
  }

  /**
   * Process incoming transcript turn from ASR
   */
  async processTranscript(turn: TranscriptTurn): Promise<OrchestratorAction> {
    const state = this.sessions.get(turn.call_id);
    if (!state) {
      throw new Error(`Session not found: ${turn.call_id}`);
    }

    // Add turn to state
    this.slotEngine.addTranscriptTurn(state, turn);

    // Emit appropriate event based on is_final
    this.emitEvent({
      type: turn.is_final ? 'final' : 'partial',
      call_id: turn.call_id,
      timestamp: new Date().toISOString(),
      data: { turn },
    });

    // Also emit generic transcript_received for backwards compatibility
    this.emitEvent({
      type: 'transcript_received',
      call_id: turn.call_id,
      timestamp: new Date().toISOString(),
      data: { turn },
    });

    // Only process final transcripts for action
    if (!turn.is_final) {
      return { action: 'none' };
    }

    // Check for safety red flags
    const redFlags = this.safetyDetector.checkRecentTurns(state.turns);
    if (redFlags.length > 0) {
      // Add red flags to snapshot
      for (const flag of redFlags) {
        if (!state.snapshot.red_flags.includes(flag.reason)) {
          state.snapshot.red_flags.push(flag.reason);
        }
      }

      // Request immediate handoff
      this.emitEvent({
        type: 'red_flag_detected',
        call_id: turn.call_id,
        timestamp: new Date().toISOString(),
        data: { flags: redFlags },
      });

      return {
        action: 'request_handoff',
        data: {
          call_id: turn.call_id,
          reason: redFlags[0].reason,
          priority: redFlags[0].priority,
        },
      };
    }

    // Get next question to ask
    const nextQuestion = this.slotEngine.getNextQuestion(state);

    if (!nextQuestion) {
      // All questions answered
      state.snapshot.completed = true;
      this.snapshots.set(turn.call_id, state.snapshot);

      this.emitEvent({
        type: 'intake_completed',
        call_id: turn.call_id,
        timestamp: new Date().toISOString(),
        data: { snapshot: state.snapshot },
      });

      return {
        action: 'speak',
        data: {
          ssml: 'Thank you for providing all the information. A staff member will be with you shortly.',
          emotion: 'calm',
        },
      };
    }

    // Build LLM prompt for the question
    const prompt = this.slotEngine.buildQuestionPrompt(nextQuestion, state);

    return {
      action: 'ask_question',
      data: {
        question: nextQuestion,
        prompt,
      },
    };
  }

  /**
   * Process LLM function call
   */
  async processFunctionCall(
    callId: string,
    functionCall: LLMFunctionCall
  ): Promise<void> {
    const state = this.sessions.get(callId);
    if (!state) {
      throw new Error(`Session not found: ${callId}`);
    }

    switch (functionCall.name) {
      case 'emit_snapshot': {
        const args = functionCall.arguments as EmitSnapshotArgs;
        await this.emitSnapshot(callId, args.snapshot);
        break;
      }

      case 'request_handoff': {
        const args = functionCall.arguments as RequestHandoffArgs;
        await this.requestHandoff(args);
        break;
      }

      case 'speak': {
        const args = functionCall.arguments as SpeakArgs;
        this.emitEvent({
          type: 'speak_request',
          call_id: callId,
          timestamp: new Date().toISOString(),
          data: args,
        });
        break;
      }
    }
  }

  /**
   * Emit and validate snapshot
   */
  async emitSnapshot(callId: string, snapshot: IntakeSnapshot): Promise<void> {
    // Validate snapshot
    const validation = this.slotEngine.validateSnapshot(snapshot);
    if (!validation.valid) {
      console.error('Snapshot validation failed:', validation.errors);
      throw new Error(`Invalid snapshot: ${validation.errors.join(', ')}`);
    }

    // Store snapshot
    this.snapshots.set(callId, snapshot);

    // Update session state
    const state = this.sessions.get(callId);
    if (state) {
      state.snapshot = snapshot;
    }

    // Emit events
    this.emitEvent({
      type: 'snapshot_updated',
      call_id: callId,
      timestamp: new Date().toISOString(),
      data: { snapshot },
    });

    // Also emit as snapshot_update for SSE compatibility
    this.emitEvent({
      type: 'snapshot_update',
      call_id: callId,
      timestamp: new Date().toISOString(),
      data: { snapshot },
    });

    console.log(`Snapshot emitted for call ${callId}`);
  }

  /**
   * Request handoff to human staff
   */
  async requestHandoff(request: RequestHandoffArgs): Promise<void> {
    this.emitEvent({
      type: 'handoff_requested',
      call_id: request.call_id,
      timestamp: new Date().toISOString(),
      data: request,
    });

    console.log(`Handoff requested for call ${request.call_id}: ${request.reason}`);
  }

  /**
   * Update slot with extracted value
   */
  updateSlot(
    callId: string,
    slot: string,
    value: any,
    confidence: number,
    evidenceTurnIds: string[]
  ): IntakeSnapshot {
    const state = this.sessions.get(callId);
    if (!state) {
      throw new Error(`Session not found: ${callId}`);
    }

    const snapshot = this.slotEngine.updateSnapshot(
      state,
      slot,
      value,
      confidence,
      evidenceTurnIds
    );

    this.snapshots.set(callId, snapshot);

    this.emitEvent({
      type: 'slot_updated',
      call_id: callId,
      timestamp: new Date().toISOString(),
      data: { slot, value, confidence },
    });

    return snapshot;
  }

  /**
   * Subscribe to orchestrator events
   */
  addEventListener(
    callId: string,
    listener: (event: OrchestratorEvent) => void
  ): void {
    if (!this.eventListeners.has(callId)) {
      this.eventListeners.set(callId, []);
    }
    this.eventListeners.get(callId)!.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(
    callId: string,
    listener: (event: OrchestratorEvent) => void
  ): void {
    const listeners = this.eventListeners.get(callId);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to listeners
   */
  private emitEvent(event: OrchestratorEvent): void {
    const listeners = this.eventListeners.get(event.call_id);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      }
    }

    // Also emit to global listeners
    const globalListeners = this.eventListeners.get('*');
    if (globalListeners) {
      for (const listener of globalListeners) {
        try {
          listener(event);
        } catch (error) {
          console.error('Error in global event listener:', error);
        }
      }
    }
  }

  /**
   * Get all sessions
   */
  getAllSessions(): Map<string, SlotEngineState> {
    return this.sessions;
  }

  /**
   * End session
   */
  endSession(callId: string): void {
    const state = this.sessions.get(callId);
    if (state) {
      this.emitEvent({
        type: 'session_ended',
        call_id: callId,
        timestamp: new Date().toISOString(),
        data: { snapshot: state.snapshot },
      });
    }

    // Clean up listeners
    this.eventListeners.delete(callId);
  }
}

// Types for orchestrator actions and events
export interface OrchestratorAction {
  action: 'none' | 'ask_question' | 'request_handoff' | 'speak';
  data?: any;
}

export interface OrchestratorEvent {
  type:
    | 'session_started'
    | 'transcript_received'
    | 'partial'
    | 'final'
    | 'red_flag_detected'
    | 'snapshot_updated'
    | 'snapshot_update'
    | 'slot_updated'
    | 'handoff_requested'
    | 'speak_request'
    | 'tts_playback'
    | 'twinmind_correction'
    | 'intake_completed'
    | 'session_ended';
  call_id: string;
  timestamp: string;
  data?: any;
}

// UUID is not available in the environment, so create a simple ID generator
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
