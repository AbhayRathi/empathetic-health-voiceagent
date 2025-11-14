import { NextRequest, NextResponse } from 'next/server';
import { TwilioService } from '@/lib/services/twilio';
import { SessionManager } from '@/lib/services/session-manager';

/**
 * Webhook endpoint for incoming Twilio calls
 * Returns TwiML to connect call to WebSocket stream
 */
export async function POST(request: NextRequest) {
  try {
    const twilioService = new TwilioService();
    const sessionManager = new SessionManager();
    
    const formData = await request.formData();
    const callSid = formData.get('CallSid') as string;
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;

    console.log(`Incoming call from ${from} to ${to}, CallSid: ${callSid}`);

    // Create session for this call
    const session = sessionManager.createSession(callSid, from);
    console.log(`Created session: ${session.id}`);

    // Generate WebSocket URL for audio streaming
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const websocketUrl = `wss://${new URL(baseUrl).host}/api/websocket?sessionId=${session.id}`;

    // Generate TwiML response
    const twiml = twilioService.generateTwiMLForIncoming(websocketUrl);

    return new NextResponse(twiml, {
      headers: {
        'Content-Type': 'text/xml',
      },
    });
  } catch (error) {
    console.error('Error handling incoming call:', error);
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>We are experiencing technical difficulties. Please try again later.</Say></Response>',
      {
        status: 500,
        headers: {
          'Content-Type': 'text/xml',
        },
      }
    );
  }
}

/**
 * Handle call status updates
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const callSid = searchParams.get('CallSid');

  if (!callSid) {
    return NextResponse.json({ error: 'CallSid required' }, { status: 400 });
  }

  try {
    const twilioService = new TwilioService();
    const callDetails = await twilioService.getCallDetails(callSid);
    return NextResponse.json(callDetails);
  } catch (error) {
    console.error('Error fetching call details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch call details' },
      { status: 500 }
    );
  }
}
