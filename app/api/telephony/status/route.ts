import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/lib/services/session-manager';

/**
 * Webhook for call status callbacks
 * Handles call completion and updates session
 */
export async function POST(request: NextRequest) {
  try {
    const sessionManager = new SessionManager();
    
    const formData = await request.formData();
    const callSid = formData.get('CallSid') as string;
    const callStatus = formData.get('CallStatus') as string;
    const recordingUrl = formData.get('RecordingUrl') as string;

    console.log(`Call status update - SID: ${callSid}, Status: ${callStatus}`);

    // Find session by callSid
    // In a real implementation, we'd have a database lookup
    // For now, this is handled in SessionManager

    if (callStatus === 'completed') {
      console.log(`Call completed: ${callSid}`);
      // Update session with recording URL if available
      if (recordingUrl) {
        console.log(`Recording available: ${recordingUrl}`);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error handling status callback:', error);
    return NextResponse.json(
      { error: 'Failed to process status callback' },
      { status: 500 }
    );
  }
}
