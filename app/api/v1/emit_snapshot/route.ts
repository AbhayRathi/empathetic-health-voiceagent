import { NextRequest, NextResponse } from 'next/server';
import { Orchestrator } from '@/lib/orchestrator';
import { IntakeSnapshot } from '@/lib/types';

// Global orchestrator instance
let orchestratorInstance: Orchestrator | null = null;

function getOrchestrator(): Orchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new Orchestrator();
  }
  return orchestratorInstance;
}

/**
 * POST /api/v1/emit_snapshot
 * Validate and store IntakeSnapshot
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const snapshot: IntakeSnapshot = body.snapshot;

    if (!snapshot || !snapshot.call_id) {
      return NextResponse.json(
        { error: 'Invalid snapshot: missing call_id' },
        { status: 400 }
      );
    }

    const orchestrator = getOrchestrator();

    // Validate and emit snapshot
    await orchestrator.emitSnapshot(snapshot.call_id, snapshot);

    return NextResponse.json({
      success: true,
      call_id: snapshot.call_id,
      timestamp: snapshot.timestamp,
    });
  } catch (error) {
    console.error('Error emitting snapshot:', error);
    return NextResponse.json(
      {
        error: 'Failed to emit snapshot',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/emit_snapshot?call_id=xxx
 * Get current snapshot for a call
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const callId = searchParams.get('call_id');

    if (!callId) {
      return NextResponse.json({ error: 'call_id required' }, { status: 400 });
    }

    const orchestrator = getOrchestrator();
    const snapshot = orchestrator.getSnapshot(callId);

    if (!snapshot) {
      return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      snapshot,
    });
  } catch (error) {
    console.error('Error fetching snapshot:', error);
    return NextResponse.json(
      { error: 'Failed to fetch snapshot' },
      { status: 500 }
    );
  }
}
