import { NextRequest, NextResponse } from 'next/server';
import { Orchestrator } from '@/lib/orchestrator';
import { TranscriptTurn } from '@/lib/types';

// Global orchestrator instance (in production, use Redis/DB for state)
let orchestratorInstance: Orchestrator | null = null;

function getOrchestrator(): Orchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new Orchestrator();
  }
  return orchestratorInstance;
}

/**
 * POST /api/v1/transcript
 * Receive ASR partial or final transcripts
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const turn: TranscriptTurn = body.turn;

    if (!turn || !turn.call_id || !turn.text) {
      return NextResponse.json(
        { error: 'Invalid transcript turn: missing required fields' },
        { status: 400 }
      );
    }

    const orchestrator = getOrchestrator();

    // Ensure session exists
    if (!orchestrator.getSession(turn.call_id)) {
      orchestrator.initializeSession(turn.call_id);
    }

    // Process the transcript
    const action = await orchestrator.processTranscript(turn);

    return NextResponse.json({
      success: true,
      action,
      turn_id: turn.turn_id,
    });
  } catch (error) {
    console.error('Error processing transcript:', error);
    return NextResponse.json(
      {
        error: 'Failed to process transcript',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/transcript?call_id=xxx
 * Get all transcript turns for a call
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const callId = searchParams.get('call_id');

    if (!callId) {
      return NextResponse.json({ error: 'call_id required' }, { status: 400 });
    }

    const orchestrator = getOrchestrator();
    const session = orchestrator.getSession(callId);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({
      call_id: callId,
      turns: session.turns,
      count: session.turns.length,
    });
  } catch (error) {
    console.error('Error fetching transcript:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transcript' },
      { status: 500 }
    );
  }
}
