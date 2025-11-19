import { TwinMindCorrection, Correction } from '../types';
import type {
  TwinMindJob,
  TwinMindSegment,
  TwinMindCorrectionEvent,
  TwinMindDiff,
  IntakeSnapshot,
  TranscriptTurn,
} from '../types';

/**
 * TwinMind Ear-3 Pro Service
 * High-accuracy async transcription with speaker diarization
 * Implements chunking, job submission, polling, rate limiting, and diff/merge
 */
export class TwinMindService {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private maxRPM: number;
  private maxRPD: number;
  private isDeveloperMode: boolean;

  // Rate limiting
  private requestQueue: Array<() => Promise<any>> = [];
  private requestTimestamps: number[] = [];
  private isProcessingQueue = false;

  // Job tracking
  private activeJobs: Map<string, TwinMindJob> = new Map();

  constructor() {
    this.apiKey = process.env.TWINMIND_API_KEY || '';
    this.baseUrl = process.env.TWINMIND_BASE_URL || 'https://api.twinmind.dev';
    this.model = process.env.TWINMIND_MODEL || 'ear-3-pro';
    this.maxRPM = parseInt(process.env.TWINMIND_MAX_RPM || '60', 10);
    this.maxRPD = parseInt(process.env.TWINMIND_MAX_RPD || '1000', 10);
    this.isDeveloperMode = process.env.DEVELOPER_MODE === 'true';

    if (!this.isDeveloperMode && !this.apiKey) {
      console.warn('TWINMIND_API_KEY not set and DEVELOPER_MODE is false. Using mock mode.');
      this.isDeveloperMode = true;
    }
  }

  /**
   * Submit audio chunk for async transcription
   * Returns job_id for polling
   */
  async submitChunk(
    callId: string,
    chunkId: string,
    audioBuffer: Buffer,
    options?: {
      numSpeakers?: number;
      prompt?: string;
      context?: string;
    }
  ): Promise<TwinMindJob> {
    if (this.isDeveloperMode) {
      return this.submitChunkMock(callId, chunkId, audioBuffer, options);
    }

    const job: TwinMindJob = {
      job_id: `job_${callId}_${chunkId}_${Date.now()}`,
      call_id: callId,
      chunk_id: chunkId,
      audio_duration_seconds: audioBuffer.length / (16000 * 2), // Estimate for 16kHz 16-bit PCM
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    // Queue the request with rate limiting
    return this.queueRequest(async () => {
      try {
        const formData = new FormData();
        formData.append('audio', new Blob([audioBuffer]), `${chunkId}.wav`);
        formData.append('model', this.model);
        
        if (options?.numSpeakers) {
          formData.append('num_speakers', options.numSpeakers.toString());
        }
        if (options?.prompt) {
          formData.append('prompt', options.prompt);
        }
        if (options?.context) {
          formData.append('context', options.context);
        }

        const response = await fetch(`${this.baseUrl}/v1/transcribe-async`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: formData,
        });

        if (!response.ok) {
          if (response.status === 429) {
            throw new Error('RATE_LIMIT_EXCEEDED');
          }
          throw new Error(`TwinMind API error: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        job.twin_job_id = result.job_id;
        job.status = 'processing';

        this.activeJobs.set(job.job_id, job);
        
        console.log(`[TwinMind] Submitted chunk ${chunkId} for call ${callId}, job: ${job.twin_job_id}`);
        
        return job;
      } catch (error: any) {
        if (error.message === 'RATE_LIMIT_EXCEEDED') {
          // Re-queue with exponential backoff
          console.warn(`[TwinMind] Rate limit hit, re-queuing job ${job.job_id}`);
          await this.delay(5000); // Wait 5 seconds
          return this.submitChunk(callId, chunkId, audioBuffer, options);
        }

        job.status = 'failed';
        job.error = error.message;
        console.error(`[TwinMind] Failed to submit chunk:`, error);
        return job;
      }
    });
  }

  /**
   * Poll job status and get result when complete
   */
  async pollJob(jobId: string, maxAttempts = 60): Promise<TwinMindSegment[] | null> {
    const job = this.activeJobs.get(jobId);
    if (!job || !job.twin_job_id) {
      console.error(`[TwinMind] Job not found: ${jobId}`);
      return null;
    }

    if (this.isDeveloperMode) {
      return this.pollJobMock(jobId);
    }

    let attempt = 0;
    let delay = 2000; // Start with 2 second delay

    while (attempt < maxAttempts) {
      attempt++;

      try {
        const statusResponse = await this.queueRequest(() =>
          fetch(`${this.baseUrl}/v1/status/${job.twin_job_id}`, {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
            },
          })
        );

        if (!statusResponse.ok) {
          throw new Error(`Status check failed: ${statusResponse.status}`);
        }

        const status = await statusResponse.json();

        if (status.status === 'completed') {
          // Get the result
          const resultResponse = await this.queueRequest(() =>
            fetch(`${this.baseUrl}/v1/result/${job.twin_job_id}`, {
              headers: {
                'Authorization': `Bearer ${this.apiKey}`,
              },
            })
          );

          if (!resultResponse.ok) {
            throw new Error(`Result fetch failed: ${resultResponse.status}`);
          }

          const result = await resultResponse.json();
          job.status = 'completed';
          job.completed_at = new Date().toISOString();

          // Normalize to TwinMindSegment format
          const segments = this.normalizeSegments(result);
          console.log(`[TwinMind] Job ${jobId} completed with ${segments.length} segments`);
          
          return segments;
        } else if (status.status === 'failed') {
          job.status = 'failed';
          job.error = status.error || 'Unknown error';
          console.error(`[TwinMind] Job ${jobId} failed:`, job.error);
          return null;
        }

        // Still processing, wait with exponential backoff
        await this.delay(delay);
        delay = Math.min(delay * 1.5, 10000); // Cap at 10 seconds
      } catch (error: any) {
        console.error(`[TwinMind] Poll attempt ${attempt} failed:`, error.message);
        
        if (error.message.includes('RATE_LIMIT')) {
          await this.delay(5000);
        } else {
          await this.delay(delay);
        }
      }
    }

    console.error(`[TwinMind] Job ${jobId} timed out after ${maxAttempts} attempts`);
    job.status = 'failed';
    job.error = 'Polling timeout';
    return null;
  }

  /**
   * Compute diffs between live transcript and TwinMind segments
   * Identifies corrections needed in IntakeSnapshot
   */
  computeDiffs(
    liveTurns: TranscriptTurn[],
    twinmindSegments: TwinMindSegment[],
    chunkStartMs: number,
    chunkEndMs: number
  ): TwinMindDiff[] {
    const diffs: TwinMindDiff[] = [];

    // Get live turns in this time window
    const relevantTurns = liveTurns.filter(
      (turn) => turn.start_ms >= chunkStartMs && turn.end_ms <= chunkEndMs
    );

    // Simple diff: compare concatenated text
    const liveText = relevantTurns.map((t) => t.text).join(' ').toLowerCase();
    const twinText = twinmindSegments.map((s) => s.text).join(' ').toLowerCase();

    if (liveText !== twinText) {
      // Text differs - check for critical fields
      const fieldsChanged = this.identifyChangedFields(liveText, twinText);

      for (const turn of relevantTurns) {
        diffs.push({
          live_turn_id: turn.turn_id,
          twin_text: twinmindSegments
            .filter(
              (s) =>
                s.start_seconds * 1000 >= turn.start_ms &&
                s.end_seconds * 1000 <= turn.end_ms
            )
            .map((s) => s.text)
            .join(' '),
          diff_type: 'modified',
          fields_changed: fieldsChanged,
        });
      }
    }

    return diffs;
  }

  /**
   * Merge TwinMind corrections into IntakeSnapshot
   * Updates answer values where corrections identify entity changes
   */
  mergeCorrections(
    snapshot: IntakeSnapshot,
    diffs: TwinMindDiff[],
    twinmindJobId: string
  ): IntakeSnapshot {
    const updated = { ...snapshot };

    for (const diff of diffs) {
      if (diff.diff_type === 'modified' && diff.fields_changed.length > 0) {
        for (const field of diff.fields_changed) {
          const slotKey = this.mapFieldToSlot(field);
          
          if (slotKey && updated.answers[slotKey]) {
            // Extract new value from twin_text
            const newValue = this.extractValueForField(diff.twin_text, field);
            
            if (newValue) {
              const existingAnswer = updated.answers[slotKey];
              updated.answers[slotKey] = {
                ...existingAnswer,
                value: newValue,
                confidence: Math.max(existingAnswer.confidence, 0.95), // TwinMind is high confidence
                evidence_turn_ids: [
                  ...existingAnswer.evidence_turn_ids,
                  `twinmind:${twinmindJobId}`,
                ],
              };

              console.log(`[TwinMind] Updated ${slotKey}: "${existingAnswer.value}" → "${newValue}"`);
            }
          }
        }
      }
    }

    updated.timestamp = new Date().toISOString();
    return updated;
  }

  /**
   * Rate-limited request queue
   */
  private async queueRequest<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      if (!this.isProcessingQueue) {
        this.processQueue();
      }
    });
  }

  /**
   * Process queued requests with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      // Check rate limits
      const now = Date.now();
      const oneMinuteAgo = now - 60000;
      const oneDayAgo = now - 86400000;

      // Clean old timestamps
      this.requestTimestamps = this.requestTimestamps.filter((ts) => ts > oneDayAgo);

      const recentRequests = this.requestTimestamps.filter((ts) => ts > oneMinuteAgo);

      if (recentRequests.length >= this.maxRPM) {
        // Wait until we can make another request
        const waitTime = 60000 - (now - recentRequests[0]);
        console.log(`[TwinMind] Rate limit: waiting ${waitTime}ms`);
        await this.delay(waitTime);
        continue;
      }

      if (this.requestTimestamps.length >= this.maxRPD) {
        console.error('[TwinMind] Daily rate limit exceeded');
        this.isProcessingQueue = false;
        return;
      }

      // Execute next request
      const request = this.requestQueue.shift();
      if (request) {
        this.requestTimestamps.push(Date.now());
        await request();
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Helper: delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Normalize TwinMind API response to segments
   */
  private normalizeSegments(apiResult: any): TwinMindSegment[] {
    // API format may vary - this is a placeholder
    const segments: TwinMindSegment[] = [];

    if (apiResult.segments) {
      for (const seg of apiResult.segments) {
        segments.push({
          speaker_label: seg.speaker || 'speaker_0',
          text: seg.text || '',
          start_seconds: seg.start || 0,
          end_seconds: seg.end || 0,
          confidence: seg.confidence || 0.95,
        });
      }
    }

    return segments;
  }

  /**
   * Identify which critical fields changed between transcripts
   */
  private identifyChangedFields(liveText: string, twinText: string): string[] {
    const fields: string[] = [];

    // Simple keyword matching - in production, use NER
    const criticalTerms = {
      medication: ['aspirin', 'ibuprofen', 'lisinopril', 'metformin', 'penicillin'],
      allergy: ['allergic', 'allergy', 'reaction'],
      dob: ['birth', 'born', '19', '20'],
    };

    for (const [field, keywords] of Object.entries(criticalTerms)) {
      for (const keyword of keywords) {
        const inLive = liveText.includes(keyword);
        const inTwin = twinText.includes(keyword);
        
        if (inLive !== inTwin || (inLive && inTwin && liveText !== twinText)) {
          if (!fields.includes(field)) {
            fields.push(field);
          }
        }
      }
    }

    return fields;
  }

  /**
   * Map field name to IntakeSnapshot slot
   */
  private mapFieldToSlot(field: string): string | null {
    const mapping: Record<string, string> = {
      medication: 'medications',
      allergy: 'allergies',
      dob: 'dob',
      name: 'full_name',
    };

    return mapping[field] || null;
  }

  /**
   * Extract value for specific field from text
   */
  private extractValueForField(text: string, field: string): string | null {
    // Placeholder - in production, use NER/entity extraction
    if (field === 'medication' || field === 'allergy') {
      // Extract drug names
      const words = text.split(' ');
      for (const word of words) {
        if (word.length > 4 && word[0] === word[0].toLowerCase()) {
          return word;
        }
      }
    }

    return text; // Fallback
  }

  // ===== MOCK IMPLEMENTATIONS FOR DEVELOPER MODE =====

  /**
   * Mock chunk submission
   */
  private async submitChunkMock(
    callId: string,
    chunkId: string,
    audioBuffer: Buffer,
    options?: any
  ): Promise<TwinMindJob> {
    const job: TwinMindJob = {
      job_id: `mock_job_${callId}_${chunkId}_${Date.now()}`,
      call_id: callId,
      chunk_id: chunkId,
      audio_duration_seconds: 30,
      status: 'processing',
      twin_job_id: `mock_twin_${Date.now()}`,
      created_at: new Date().toISOString(),
    };

    this.activeJobs.set(job.job_id, job);
    console.log(`[TwinMind Mock] Submitted chunk ${chunkId} for call ${callId}`);

    return job;
  }

  /**
   * Mock job polling
   */
  private async pollJobMock(jobId: string): Promise<TwinMindSegment[]> {
    await this.delay(2000); // Simulate processing time

    const job = this.activeJobs.get(jobId);
    if (job) {
      job.status = 'completed';
      job.completed_at = new Date().toISOString();
    }

    // Return mock corrected segments
    const mockSegments: TwinMindSegment[] = [
      {
        speaker_label: 'speaker_0',
        text: 'My name is John Smith and I take lisinopril for blood pressure.',
        start_seconds: 0,
        end_seconds: 5,
        confidence: 0.96,
      },
      {
        speaker_label: 'speaker_1',
        text: 'Thank you. Are you allergic to any medications?',
        start_seconds: 5.5,
        end_seconds: 8,
        confidence: 0.98,
      },
      {
        speaker_label: 'speaker_0',
        text: 'Yes, I am allergic to penicillin.',
        start_seconds: 8.5,
        end_seconds: 11,
        confidence: 0.97,
      },
    ];

    console.log(`[TwinMind Mock] Job ${jobId} completed with ${mockSegments.length} segments`);
    
    return mockSegments;
  }

  // Legacy compatibility
  async correctTranscript(
    sessionId: string,
    originalTranscript: string,
    audioUrl?: string
  ): Promise<TwinMindCorrection> {
    return {
      sessionId,
      originalTranscript,
      correctedTranscript: originalTranscript,
      corrections: [],
      confidence: 0.95,
      processedAt: new Date(),
    };
  }
}

