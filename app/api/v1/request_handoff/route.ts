import { NextRequest, NextResponse } from 'next/server';
import { Orchestrator } from '@/lib/orchestrator';
import { RequestHandoffArgs } from '@/lib/types';

// Global orchestrator instance
let orchestratorInstance: Orchestrator | null = null;

function getOrchestrator(): Orchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new Orchestrator();
  }
  return orchestratorInstance;
}

/**
 * POST /api/v1/request_handoff
 * Request handoff to human staff (safety escalation)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const handoffRequest: RequestHandoffArgs = body;

    if (!handoffRequest.call_id || !handoffRequest.reason) {
      return NextResponse.json(
        { error: 'Invalid handoff request: call_id and reason required' },
        { status: 400 }
      );
    }

    const orchestrator = getOrchestrator();

    // Process handoff request
    await orchestrator.requestHandoff(handoffRequest);

    // Log urgent event
    console.log(`[URGENT HANDOFF] Call: ${handoffRequest.call_id}, Reason: ${handoffRequest.reason}, Priority: ${handoffRequest.priority || 'normal'}`);

    return NextResponse.json({
      success: true,
      call_id: handoffRequest.call_id,
      reason: handoffRequest.reason,
      priority: handoffRequest.priority || 'normal',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error processing handoff request:', error);
    return NextResponse.json(
      {
        error: 'Failed to process handoff request',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/request_handoff?call_id=xxx
 * Get handoff requests for a call (for staff dashboard)
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

    // Return red flags as handoff indicators
    return NextResponse.json({
      call_id: callId,
      red_flags: session.snapshot.red_flags,
      requires_handoff: session.snapshot.red_flags.length > 0,
    });
  } catch (error) {
    console.error('Error fetching handoff status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch handoff status' },
      { status: 500 }
    );
  }
}
