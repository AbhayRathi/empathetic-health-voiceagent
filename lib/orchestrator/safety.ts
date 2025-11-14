import { RedFlagRule, TranscriptTurn } from '../types';

/**
 * Safety Red-Flag Detector
 * Rule-based detection of emergency/safety situations
 * that require immediate handoff to human staff
 */
export class SafetyDetector {
  private rules: RedFlagRule[];

  constructor() {
    this.rules = [
      // Chest pain + shortness of breath (cardiac emergency)
      {
        tokens: [
          ['chest pain', 'shortness of breath'],
          ['chest pain', 'can\'t breathe'],
          ['chest pain', 'difficulty breathing'],
        ],
        reason: 'Potential cardiac emergency: chest pain with respiratory distress',
        priority: 'urgent',
      },
      // Stroke signs
      {
        tokens: [
          ['face droop', 'slurred speech'],
          ['facial droop', 'speech slurred'],
          ['face drooping', 'can\'t speak'],
          ['arm weakness', 'face droop'],
        ],
        reason: 'Potential stroke: FAST symptoms detected',
        priority: 'urgent',
      },
      // Suicidal ideation
      {
        tokens: [
          ['want to kill myself'],
          ['suicide'],
          ['suicidal'],
          ['end my life'],
          ['don\'t want to live'],
        ],
        reason: 'Suicidal ideation detected',
        priority: 'urgent',
      },
      // Severe allergic reaction
      {
        tokens: [
          ['throat swelling', 'can\'t breathe'],
          ['allergic reaction', 'throat closing'],
          ['anaphylaxis'],
          ['epipen', 'can\'t breathe'],
        ],
        reason: 'Potential anaphylaxis: severe allergic reaction',
        priority: 'urgent',
      },
      // Severe bleeding
      {
        tokens: [
          ['bleeding', 'won\'t stop'],
          ['heavy bleeding'],
          ['blood', 'can\'t stop'],
        ],
        reason: 'Severe bleeding reported',
        priority: 'urgent',
      },
      // Loss of consciousness
      {
        tokens: [
          ['passed out'],
          ['lost consciousness'],
          ['fainted'],
          ['blacked out'],
        ],
        reason: 'Loss of consciousness reported',
        priority: 'high',
      },
      // Severe pain
      {
        tokens: [
          ['worst pain', 'ever'],
          ['10 out of 10 pain'],
          ['unbearable pain'],
        ],
        reason: 'Severe pain reported',
        priority: 'high',
      },
    ];
  }

  /**
   * Check if transcript contains any red flag patterns
   */
  detectRedFlags(turns: TranscriptTurn[]): Array<{
    reason: string;
    priority: 'urgent' | 'high' | 'normal';
    evidence: string[];
  }> {
    const flags: Array<{
      reason: string;
      priority: 'urgent' | 'high' | 'normal';
      evidence: string[];
    }> = [];

    // Combine all patient turns into a single text
    const patientText = turns
      .filter((t) => t.speaker === 'patient')
      .map((t) => t.text)
      .join(' ')
      .toLowerCase();

    // Check each rule
    for (const rule of this.rules) {
      const matches = this.checkRule(patientText, rule);
      if (matches.length > 0) {
        flags.push({
          reason: rule.reason,
          priority: rule.priority,
          evidence: matches,
        });
      }
    }

    return flags;
  }

  /**
   * Check a single red flag rule against text
   */
  private checkRule(text: string, rule: RedFlagRule): string[] {
    const matches: string[] = [];

    for (const tokenSet of rule.tokens) {
      // Check if all tokens in the set appear in the text
      const allPresent = tokenSet.every((token) => {
        const regex = new RegExp(`\\b${this.escapeRegex(token)}\\b`, 'i');
        return regex.test(text);
      });

      if (allPresent) {
        matches.push(tokenSet.join(' + '));
      }
    }

    return matches;
  }

  /**
   * Check recent turns for red flags (for real-time detection)
   */
  checkRecentTurns(
    turns: TranscriptTurn[],
    windowSize: number = 5
  ): Array<{
    reason: string;
    priority: 'urgent' | 'high' | 'normal';
    evidence: string[];
  }> {
    // Only check the last N turns
    const recentTurns = turns.slice(-windowSize);
    return this.detectRedFlags(recentTurns);
  }

  /**
   * Check if ASR confidence is too low for a required slot
   */
  checkLowConfidence(
    confidence: number,
    isRequiredSlot: boolean
  ): { needsClarification: boolean; reason?: string } {
    if (isRequiredSlot && confidence < 0.6) {
      return {
        needsClarification: true,
        reason: `Low ASR confidence (${confidence.toFixed(2)}) for required information`,
      };
    }

    return { needsClarification: false };
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Add custom rule at runtime
   */
  addRule(rule: RedFlagRule): void {
    this.rules.push(rule);
  }

  /**
   * Get all rules
   */
  getRules(): RedFlagRule[] {
    return this.rules;
  }
}
