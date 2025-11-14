import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/lib/services/session-manager';

/**
 * Get session details and current snapshot
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionManager = new SessionManager();
    const { id: sessionId } = await params;
    const session = sessionManager.getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      session: {
        id: session.id,
        status: session.status,
        startTime: session.startTime,
        endTime: session.endTime,
        phoneNumber: session.phoneNumber,
      },
      snapshot: session.snapshot,
      transcript: session.transcript,
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    );
  }
}

/**
 * End a session
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionManager = new SessionManager();
    const { id: sessionId } = await params;
    const session = await sessionManager.endSession(sessionId);

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        status: session.status,
        endTime: session.endTime,
      },
    });
  } catch (error) {
    console.error('Error ending session:', error);
    return NextResponse.json(
      { error: 'Failed to end session' },
      { status: 500 }
    );
  }
}
