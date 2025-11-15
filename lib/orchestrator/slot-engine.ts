import {
  IntakeSnapshot,
  IntakeQuestion,
  SlotEngineState,
  TranscriptTurn,
  SlotAnswer,
} from '../types';
import intakeQuestionsData from '../../shared/schemas/intake.questions.json';

/**
 * Slot Engine
 * Manages intake question flow, maintains IntakeSnapshot state,
 * and determines next question to ask.
 */
export class SlotEngine {
  private questions: IntakeQuestion[];

  constructor() {
    // Load questions from schema
    this.questions = (intakeQuestionsData as any).data.questions;
  }

  /**
   * Initialize a new slot engine state for a call
   */
  initializeState(callId: string): SlotEngineState {
    const snapshot: IntakeSnapshot = {
      call_id: callId,
      answers: {},
      red_flags: [],
      completed: false,
      timestamp: new Date().toISOString(),
    };

    return {
      call_id: callId,
      questions: this.questions,
      current_question_index: 0,
      snapshot,
      turns: [],
    };
  }

  /**
   * Get the next required slot/question that needs to be asked
   */
  getNextQuestion(state: SlotEngineState): IntakeQuestion | null {
    for (let i = 0; i < this.questions.length; i++) {
      const question = this.questions[i];
      const answer = state.snapshot.answers[question.slot];

      // If required question not filled or status is unknown, ask it
      if (question.required && (!answer || answer.status !== 'filled')) {
        return question;
      }
    }

    return null; // All questions answered
  }

  /**
   * Build LLM prompt to ask the verbatim question
   */
  buildQuestionPrompt(question: IntakeQuestion, state: SlotEngineState): string {
    const context = this.buildContextSummary(state);
    
    return `You are asking the patient intake question. 

Context so far:
${context}

Now ask this question VERBATIM:
"${question.verbatim}"

Be warm, empathetic, and professional. If this is a sensitive question (allergies, medications), explain why we're asking.`;
  }

  /**
   * Update snapshot with extracted information from LLM
   */
  updateSnapshot(
    state: SlotEngineState,
    slot: string,
    value: any,
    confidence: number,
    evidenceTurnIds: string[]
  ): IntakeSnapshot {
    const answer: SlotAnswer = {
      value,
      confidence,
      status: confidence >= 0.6 ? 'filled' : 'unknown',
      evidence_turn_ids: evidenceTurnIds,
    };

    state.snapshot.answers[slot] = answer;
    state.snapshot.timestamp = new Date().toISOString();

    // Check if patient info slots are filled
    if (slot === 'full_name') {
      state.snapshot.patient = state.snapshot.patient || {};
      state.snapshot.patient.full_name = value;
    } else if (slot === 'dob') {
      state.snapshot.patient = state.snapshot.patient || {};
      state.snapshot.patient.dob = value;
    } else if (slot === 'callback_number') {
      state.snapshot.patient = state.snapshot.patient || {};
      state.snapshot.patient.callback_number = value;
    }

    // Check if all required questions are answered
    state.snapshot.completed = this.checkCompletion(state);

    return state.snapshot;
  }

  /**
   * Check if all required slots are filled
   */
  private checkCompletion(state: SlotEngineState): boolean {
    for (const question of this.questions) {
      if (question.required) {
        const answer = state.snapshot.answers[question.slot];
        if (!answer || answer.status !== 'filled') {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Add a transcript turn to the state
   */
  addTranscriptTurn(state: SlotEngineState, turn: TranscriptTurn): void {
    state.turns.push(turn);
  }

  /**
   * Validate IntakeSnapshot against JSON schema
   */
  validateSnapshot(snapshot: IntakeSnapshot): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!snapshot.call_id) {
      errors.push('call_id is required');
    }

    if (typeof snapshot.answers !== 'object') {
      errors.push('answers must be an object');
    }

    if (!Array.isArray(snapshot.red_flags)) {
      errors.push('red_flags must be an array');
    }

    if (typeof snapshot.completed !== 'boolean') {
      errors.push('completed must be a boolean');
    }

    if (!snapshot.timestamp) {
      errors.push('timestamp is required');
    }

    // Validate each answer
    for (const [slot, answer] of Object.entries(snapshot.answers)) {
      if (!answer.status) {
        errors.push(`Answer for ${slot} must have status`);
      } else if (!['filled', 'unknown', 'not_applicable'].includes(answer.status)) {
        errors.push(`Answer for ${slot} has invalid status: ${answer.status}`);
      }

      if (typeof answer.confidence !== 'number' || answer.confidence < 0 || answer.confidence > 1) {
        errors.push(`Answer for ${slot} must have confidence between 0 and 1`);
      }

      if (!Array.isArray(answer.evidence_turn_ids)) {
        errors.push(`Answer for ${slot} must have evidence_turn_ids array`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Build a context summary for the LLM
   */
  private buildContextSummary(state: SlotEngineState): string {
    const filledSlots: string[] = [];
    
    for (const [slot, answer] of Object.entries(state.snapshot.answers)) {
      if (answer.status === 'filled') {
        filledSlots.push(`${slot}: ${answer.value}`);
      }
    }

    if (filledSlots.length === 0) {
      return 'No information collected yet.';
    }

    return `Collected information:\n${filledSlots.join('\n')}`;
  }

  /**
   * Get all questions
   */
  getAllQuestions(): IntakeQuestion[] {
    return this.questions;
  }
}
