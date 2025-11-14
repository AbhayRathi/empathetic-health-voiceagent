import OpenAI from 'openai';
import {
  IntakeSnapshot,
  IntakeQuestion,
  SlotEngineState,
  LLMFunctionCall,
  TranscriptTurn,
} from '../types';

/**
 * Enhanced GPT Service for Orchestrator
 * Implements function calling for slot-filling, handoff, and speech
 */
export class OrchestratorGPT {
  private client: OpenAI;
  private model: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('OPENAI_API_KEY not set - using mock mode');
    }
    this.client = new OpenAI({ apiKey: apiKey || 'mock-key' });
    this.model = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
  }

  /**
   * Get system prompt for intake assistant
   */
  private getSystemPrompt(): string {
    return `You are a warm, empathetic medical-intake assistant. Goals: 
(1) capture all required fields from the provided intake questions exactly as written, 
(2) ask one question at a time, 
(3) confirm critical details, 
(4) never diagnose, and 
(5) if a safety red-flag appears (chest pain + shortness of breath, stroke signs, suicidal ideation) immediately call request_handoff(reason) and instruct the caller to call emergency services. 

Use short, plain language. Return structured JSON only using the provided function schemas: emit_snapshot(snapshot), request_handoff(reason), speak(ssml, emotion).`;
  }

  /**
   * Get LLM function/tool definitions
   */
  private getFunctionDefinitions(): OpenAI.Chat.ChatCompletionTool[] {
    return [
      {
        type: 'function',
        function: {
          name: 'emit_snapshot',
          description: 'Emit an updated IntakeSnapshot with filled slot values',
          parameters: {
            type: 'object',
            properties: {
              snapshot: {
                type: 'object',
                description: 'Complete IntakeSnapshot object',
                properties: {
                  call_id: { type: 'string' },
                  patient: {
                    type: 'object',
                    properties: {
                      full_name: { type: 'string' },
                      dob: { type: 'string', format: 'date' },
                      callback_number: { type: 'string' },
                    },
                  },
                  answers: {
                    type: 'object',
                    additionalProperties: {
                      type: 'object',
                      properties: {
                        value: {},
                        confidence: { type: 'number', minimum: 0, maximum: 1 },
                        status: {
                          type: 'string',
                          enum: ['filled', 'unknown', 'not_applicable'],
                        },
                        evidence_turn_ids: {
                          type: 'array',
                          items: { type: 'string' },
                        },
                      },
                      required: ['status', 'confidence', 'evidence_turn_ids'],
                    },
                  },
                  red_flags: { type: 'array', items: { type: 'string' } },
                  completed: { type: 'boolean' },
                  timestamp: { type: 'string', format: 'date-time' },
                },
                required: ['call_id', 'answers', 'completed', 'timestamp'],
              },
            },
            required: ['snapshot'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'request_handoff',
          description:
            'Request immediate handoff to human staff for safety or emergency situations',
          parameters: {
            type: 'object',
            properties: {
              call_id: { type: 'string' },
              reason: {
                type: 'string',
                description: 'Detailed reason for handoff',
              },
              priority: {
                type: 'string',
                enum: ['urgent', 'high', 'normal'],
                default: 'normal',
              },
            },
            required: ['call_id', 'reason'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'speak',
          description: 'Generate speech response to the patient',
          parameters: {
            type: 'object',
            properties: {
              ssml: {
                type: 'string',
                description: 'Text or SSML to speak to the patient',
              },
              emotion: {
                type: 'string',
                enum: ['calm', 'concerned', 'encouraging'],
                default: 'calm',
              },
            },
            required: ['ssml'],
          },
        },
      },
    ];
  }

  /**
   * Call LLM to ask next question or process patient response
   */
  async callLLM(
    state: SlotEngineState,
    nextQuestion: IntakeQuestion | null,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<{
    response: string;
    functionCalls?: LLMFunctionCall[];
  }> {
    try {
      // Build messages
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: this.getSystemPrompt(),
        },
      ];

      // Add context about current state
      const contextMessage = this.buildContextMessage(state, nextQuestion);
      messages.push({
        role: 'system',
        content: contextMessage,
      });

      // Add conversation history
      for (const msg of conversationHistory) {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }

      // Call OpenAI with function calling
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages,
        tools: this.getFunctionDefinitions(),
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 500,
      });

      const choice = completion.choices[0];
      const message = choice.message;

      const functionCalls: LLMFunctionCall[] = [];

      // Extract function calls
      if (message.tool_calls && message.tool_calls.length > 0) {
        for (const toolCall of message.tool_calls) {
          if (toolCall.type === 'function') {
            functionCalls.push({
              name: toolCall.function.name as any,
              arguments: JSON.parse(toolCall.function.arguments),
            });
          }
        }
      }

      return {
        response: message.content || '',
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
      };
    } catch (error) {
      console.error('LLM call error:', error);

      // Fallback to mock response in dev mode
      if (process.env.DEVELOPER_MODE === 'true') {
        return this.mockLLMResponse(nextQuestion);
      }

      throw error;
    }
  }

  /**
   * Build context message for LLM
   */
  private buildContextMessage(
    state: SlotEngineState,
    nextQuestion: IntakeQuestion | null
  ): string {
    const filledSlots = Object.entries(state.snapshot.answers)
      .filter(([_, answer]) => answer.status === 'filled')
      .map(([slot, answer]) => `${slot}: ${answer.value}`)
      .join(', ');

    let context = `Current call: ${state.call_id}\n`;
    context += `Collected info: ${filledSlots || 'None yet'}\n`;

    if (nextQuestion) {
      context += `\nNext question to ask VERBATIM: "${nextQuestion.verbatim}"\n`;
      context += `This question fills slot: ${nextQuestion.slot}\n`;
    } else {
      context += `\nAll required questions have been answered.\n`;
    }

    if (state.snapshot.red_flags.length > 0) {
      context += `\nRED FLAGS DETECTED: ${state.snapshot.red_flags.join(', ')}\n`;
    }

    return context;
  }

  /**
   * Mock LLM response for development mode
   */
  private mockLLMResponse(
    nextQuestion: IntakeQuestion | null
  ): { response: string; functionCalls?: LLMFunctionCall[] } {
    if (!nextQuestion) {
      return {
        response: 'Thank you for providing all the information.',
        functionCalls: [
          {
            name: 'speak',
            arguments: {
              ssml: 'Thank you for providing all the information. A staff member will be with you shortly.',
              emotion: 'calm',
            },
          },
        ],
      };
    }

    return {
      response: nextQuestion.verbatim,
      functionCalls: [
        {
          name: 'speak',
          arguments: {
            ssml: nextQuestion.verbatim,
            emotion: 'calm',
          },
        },
      ],
    };
  }

  /**
   * Extract slot value from patient response
   */
  async extractSlotValue(
    slot: string,
    patientResponse: string,
    questionContext: string
  ): Promise<{
    value: any;
    confidence: number;
  }> {
    try {
      const prompt = `Extract the ${slot} from this patient response: "${patientResponse}"
Context: ${questionContext}

Return JSON: {"value": <extracted_value>, "confidence": <0-1>}`;

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You extract information from patient responses.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error('No content in response');
      }

      return JSON.parse(content);
    } catch (error) {
      console.error('Extraction error:', error);
      return {
        value: patientResponse,
        confidence: 0.5,
      };
    }
  }
}
