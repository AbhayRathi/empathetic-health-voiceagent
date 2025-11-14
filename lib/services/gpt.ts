import OpenAI from 'openai';
import { GPTMessage, GPTResponse, PatientIntakeSnapshot, RequiredQuestion } from '../types';

export class GPTService {
  private client: OpenAI;
  private systemPrompt: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required');
    }
    this.client = new OpenAI({ apiKey });
    this.systemPrompt = this.buildSystemPrompt();
  }

  private buildSystemPrompt(): string {
    return `You are an empathetic AI health intake assistant. Your role is to:

1. Conduct patient intake interviews with warmth and professionalism
2. Ask required questions VERBATIM as specified
3. Listen actively and show empathy for patient concerns
4. Confirm important information to ensure accuracy
5. Extract structured data from conversations
6. Maintain HIPAA compliance - never share or store PHI improperly

Guidelines:
- Use a caring, professional tone
- Ask clarifying questions when needed
- Confirm sensitive information (allergies, medications, symptoms)
- If patient seems distressed, acknowledge their feelings
- Keep questions clear and concise
- Use simple language, avoid medical jargon unless necessary

Required Questions to Ask (VERBATIM):
1. "What is your full name?"
2. "What is your date of birth?"
3. "What brings you in today?"
4. "Do you have any allergies to medications?"
5. "What medications are you currently taking?"
6. "Have you experienced these symptoms before?"

Always confirm answers to critical questions like allergies and medications.
Extract information in JSON format when requested.`;
  }

  /**
   * Generate empathetic response based on conversation history
   */
  async generateResponse(
    messages: GPTMessage[],
    snapshot: PatientIntakeSnapshot,
    requiredQuestions: RequiredQuestion[]
  ): Promise<GPTResponse> {
    try {
      // Find next required question to ask
      const nextQuestion = requiredQuestions.find(q => !q.asked);
      
      // Build context about what we know and what we need
      const contextMessage: GPTMessage = {
        role: 'system',
        content: `Current intake snapshot: ${JSON.stringify({
          hasName: !!snapshot.personalInfo.name,
          hasDOB: !!snapshot.personalInfo.dateOfBirth,
          hasChiefComplaint: !!snapshot.medicalInfo.chiefComplaint,
          questionsRemaining: requiredQuestions.filter(q => !q.asked).length,
          nextQuestion: nextQuestion?.verbatim,
        })}`,
      };

      const allMessages = [
        { role: 'system' as const, content: this.systemPrompt },
        contextMessage,
        ...messages,
      ];

      const completion = await this.client.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: allMessages,
        temperature: 0.7,
        max_tokens: 500,
      });

      const responseText = completion.choices[0]?.message?.content || '';

      // Determine if we should confirm the answer
      const shouldConfirm = this.shouldConfirmAnswer(messages, responseText);

      return {
        message: responseText,
        shouldConfirm,
        questionId: nextQuestion?.id,
      };
    } catch (error) {
      console.error('GPT API error:', error);
      throw new Error('Failed to generate response');
    }
  }

  /**
   * Extract structured information from conversation
   */
  async extractInformation(transcript: string): Promise<Partial<PatientIntakeSnapshot>> {
    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `Extract patient intake information from the transcript. Return ONLY valid JSON with these fields:
{
  "personalInfo": {
    "name": "string or null",
    "dateOfBirth": "string or null",
    "phoneNumber": "string or null",
    "email": "string or null"
  },
  "medicalInfo": {
    "chiefComplaint": "string or null",
    "symptoms": ["array of strings"],
    "allergies": ["array of strings"],
    "medications": ["array of strings"]
  },
  "visitReason": "string or null"
}

Only include information explicitly stated in the transcript. Use null for missing fields.`,
          },
          {
            role: 'user',
            content: `Extract information from this transcript:\n\n${transcript}`,
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in GPT response');
      }

      return JSON.parse(content);
    } catch (error) {
      console.error('Information extraction error:', error);
      throw error;
    }
  }

  private shouldConfirmAnswer(messages: GPTMessage[], response: string): boolean {
    // Check if response is about allergies, medications, or other critical info
    const criticalKeywords = ['allerg', 'medicat', 'prescri', 'symptom'];
    const responseText = response.toLowerCase();
    
    return criticalKeywords.some(keyword => responseText.includes(keyword));
  }
}
