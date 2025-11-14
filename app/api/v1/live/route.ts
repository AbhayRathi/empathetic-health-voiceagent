import { NextRequest } from 'next/server';
import { Orchestrator, OrchestratorEvent } from '@/lib/orchestrator';

// Global orchestrator instance
let orchestratorInstance: Orchestrator | null = null;

function getOrchestrator(): Orchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new Orchestrator();
  }
  return orchestratorInstance;
}

/**
 * GET /api/v1/live?call_id=xxx
 * Server-Sent Events stream for live transcript and snapshot updates
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const callId = searchParams.get('call_id') || '*'; // * for all calls

  const encoder = new TextEncoder();

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      const orchestrator = getOrchestrator();

      // Send initial connection message
      const initialData = `data: ${JSON.stringify({ type: 'connected', call_id: callId })}\n\n`;
      controller.enqueue(encoder.encode(initialData));

      // Set up event listener
      const listener = (event: OrchestratorEvent) => {
        try {
          const eventData = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(eventData));
        } catch (error) {
          console.error('Error sending SSE event:', error);
        }
      };

      orchestrator.addEventListener(callId, listener);

      // Send current state if specific call_id
      if (callId !== '*') {
        const session = orchestrator.getSession(callId);
        if (session) {
          const stateData = `data: ${JSON.stringify({
            type: 'current_state',
            call_id: callId,
            snapshot: session.snapshot,
            turns: session.turns,
            timestamp: new Date().toISOString(),
          })}\n\n`;
          controller.enqueue(encoder.encode(stateData));
        }
      }

      // Keep-alive ping every 30 seconds
      const keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'));
        } catch (error) {
          clearInterval(keepAliveInterval);
        }
      }, 30000);

      // Clean up on close
      request.signal.addEventListener('abort', () => {
        orchestrator.removeEventListener(callId, listener);
        clearInterval(keepAliveInterval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
