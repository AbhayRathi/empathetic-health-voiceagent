'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface TranscriptTurn {
  turn_id: string;
  call_id: string;
  speaker: 'patient' | 'agent';
  text: string;
  start_ms: number;
  end_ms: number;
  asr_confidence: number;
  is_final?: boolean;
}

interface IntakeSnapshot {
  call_id: string;
  patient?: {
    full_name?: string;
    dob?: string;
    callback_number?: string;
  };
  answers: Record<string, {
    value?: any;
    confidence: number;
    status: 'filled' | 'unknown' | 'not_applicable';
    evidence_turn_ids: string[];
  }>;
  red_flags: string[];
  completed: boolean;
  timestamp: string;
}

interface LiveSession {
  call_id: string;
  turns: TranscriptTurn[];
  snapshot: IntakeSnapshot;
  current_question?: string;
  status: 'active' | 'completed' | 'handoff_requested';
  lastUpdate: number;
}

export default function StaffDashboard() {
  const [liveSessions, setLiveSessions] = useState<Map<string, LiveSession>>(new Map());
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Connect to SSE stream
  useEffect(() => {
    const connectSSE = () => {
      console.log('Connecting to live event stream...');
      const eventSource = new EventSource('/api/v1/live?call_id=*');
      
      eventSource.onopen = () => {
        console.log('✓ Connected to live stream');
        setConnected(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleLiveEvent(data);
        } catch (error) {
          console.error('Error parsing SSE message:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        setConnected(false);
        eventSource.close();
        // Reconnect after 5 seconds
        setTimeout(connectSSE, 5000);
      };

      eventSourceRef.current = eventSource;
    };

    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const handleLiveEvent = (event: any) => {
    const callId = event.call_id;
    if (!callId) return;

    setLiveSessions((prev) => {
      const updated = new Map(prev);
      const session: LiveSession = updated.get(callId) || {
        call_id: callId,
        turns: [] as TranscriptTurn[],
        snapshot: {
          call_id: callId,
          answers: {},
          red_flags: [],
          completed: false,
          timestamp: new Date().toISOString(),
        },
        status: 'active' as const,
        lastUpdate: Date.now(),
      };

      switch (event.type) {
        case 'session_started':
          session.status = 'active';
          session.lastUpdate = Date.now();
          break;

        case 'transcript_received':
          if (event.data?.turn) {
            const turn = event.data.turn as TranscriptTurn;
            // Only add if not already present
            if (!session.turns.find(t => t.turn_id === turn.turn_id)) {
              session.turns.push(turn);
            }
            session.lastUpdate = Date.now();
          }
          break;

        case 'snapshot_updated':
          if (event.data?.snapshot) {
            session.snapshot = event.data.snapshot;
            session.lastUpdate = Date.now();
          }
          break;

        case 'red_flag_detected':
          session.status = 'handoff_requested';
          if (event.data?.flags) {
            session.snapshot.red_flags = event.data.flags.map((f: any) => f.reason);
          }
          session.lastUpdate = Date.now();
          break;

        case 'handoff_requested':
          session.status = 'handoff_requested';
          session.lastUpdate = Date.now();
          break;

        case 'intake_completed':
          session.snapshot.completed = true;
          session.status = 'completed';
          session.lastUpdate = Date.now();
          break;

        case 'session_ended':
          session.status = 'completed';
          session.lastUpdate = Date.now();
          break;

        case 'current_state':
          if (event.snapshot) session.snapshot = event.snapshot;
          if (event.turns) session.turns = event.turns;
          session.lastUpdate = Date.now();
          break;
      }

      updated.set(callId, session);
      return updated;
    });
  };

  const handleRequestHandoff = async (callId: string) => {
    try {
      const response = await fetch('/api/v1/request_handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_id: callId,
          reason: 'Staff requested manual handoff',
          priority: 'normal',
        }),
      });

      if (response.ok) {
        alert('Handoff request sent successfully');
      }
    } catch (error) {
      console.error('Failed to request handoff:', error);
      alert('Failed to request handoff');
    }
  };

  const sessions = Array.from(liveSessions.values()).sort((a, b) => b.lastUpdate - a.lastUpdate);
  const selectedSession = selectedCallId ? liveSessions.get(selectedCallId) : null;
  const activeSessions = sessions.filter(s => s.status === 'active');
  const completedSessions = sessions.filter(s => s.status === 'completed');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Staff Dashboard - Live Monitor</h1>
              <p className="text-sm text-gray-600 mt-1">
                Real-time intake session monitoring with SSE
                <span className={`ml-3 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  connected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  <span className={`w-2 h-2 rounded-full mr-1.5 ${
                    connected ? 'bg-green-600 animate-pulse' : 'bg-red-600'
                  }`}></span>
                  {connected ? 'Connected' : 'Disconnected'}
                </span>
              </p>
            </div>
            <Link
              href="/"
              className="text-blue-600 hover:text-blue-800"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Total Sessions</div>
            <div className="text-3xl font-bold text-gray-900">{sessions.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Active Now</div>
            <div className="text-3xl font-bold text-green-600">
              {activeSessions.length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Completed</div>
            <div className="text-3xl font-bold text-blue-600">
              {completedSessions.length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Red Flags</div>
            <div className="text-3xl font-bold text-red-600">
              {sessions.filter(s => s.snapshot.red_flags.length > 0).length}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sessions List */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold">Live Sessions</h2>
            </div>
            
            <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
              {sessions.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <div className="text-5xl mb-3">📡</div>
                  <p>Waiting for live sessions...</p>
                  <p className="text-sm mt-2">Start a simulation to see data</p>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded mt-2 inline-block">
                    make simulate
                  </code>
                </div>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.call_id}
                    className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                      selectedCallId === session.call_id ? 'bg-blue-50' : ''
                    } ${session.snapshot.red_flags.length > 0 ? 'border-l-4 border-red-500' : ''}`}
                    onClick={() => setSelectedCallId(session.call_id)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {session.snapshot.patient?.full_name || `Call ${session.call_id.substring(0, 12)}`}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {session.snapshot.patient?.callback_number || 'No phone'}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          session.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : session.status === 'completed'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {session.status === 'handoff_requested' ? '🚨 HANDOFF' : session.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                      <span>Turns: {session.turns.length}</span>
                      <span>•</span>
                      <span>Progress: {Object.keys(session.snapshot.answers).length}/7</span>
                    </div>
                    {session.snapshot.red_flags.length > 0 && (
                      <div className="mt-2 text-xs text-red-600 font-medium">
                        ⚠️ {session.snapshot.red_flags[0]}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Session Details */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-semibold">Live Details</h2>
              {selectedSession && selectedSession.status === 'active' && (
                <button
                  onClick={() => handleRequestHandoff(selectedSession.call_id)}
                  className="px-4 py-2 bg-orange-600 text-white rounded-md text-sm font-medium hover:bg-orange-700"
                >
                  Request Handoff
                </button>
              )}
            </div>
            
            <div className="p-6 max-h-[600px] overflow-y-auto">
              {selectedSession ? (
                <div className="space-y-6">
                  {/* Red Flags Alert */}
                  {selectedSession.snapshot.red_flags.length > 0 && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4">
                      <div className="flex items-start">
                        <div className="text-2xl mr-3">🚨</div>
                        <div>
                          <h3 className="text-sm font-bold text-red-800 mb-1">
                            Safety Red Flags Detected
                          </h3>
                          <ul className="text-sm text-red-700 space-y-1">
                            {selectedSession.snapshot.red_flags.map((flag, i) => (
                              <li key={i}>• {flag}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Live Transcript */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-gray-900">
                      Live Transcript ({selectedSession.turns.length} turns)
                    </h3>
                    <div className="bg-gray-900 rounded-lg p-4 max-h-64 overflow-y-auto space-y-2 font-mono text-sm">
                      {selectedSession.turns.length === 0 ? (
                        <div className="text-gray-400 text-center py-4">
                          Waiting for transcript...
                        </div>
                      ) : (
                        selectedSession.turns.map((turn, idx) => (
                          <div key={turn.turn_id} className="flex gap-2">
                            <span className="text-gray-500">{idx + 1}.</span>
                            <span className={`font-semibold ${
                              turn.speaker === 'agent' ? 'text-blue-400' : 'text-green-400'
                            }`}>
                              [{turn.speaker.toUpperCase()}]
                            </span>
                            <span className="text-gray-200">{turn.text}</span>
                            {turn.asr_confidence < 0.7 && (
                              <span className="text-yellow-400 text-xs">⚠️</span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Slot Progress */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-gray-900">
                      Intake Progress
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(selectedSession.snapshot.answers).map(([slot, answer]) => (
                        <div key={slot} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex items-center gap-2">
                            <span className={`w-3 h-3 rounded-full ${
                              answer.status === 'filled' ? 'bg-green-500' :
                              answer.status === 'unknown' ? 'bg-yellow-500' :
                              'bg-gray-300'
                            }`}></span>
                            <span className="text-sm font-medium text-gray-700">
                              {slot.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600">
                            {answer.status === 'filled' ? (
                              <span className="text-green-600 font-medium">
                                {typeof answer.value === 'string' ? answer.value : JSON.stringify(answer.value)}
                              </span>
                            ) : (
                              <span className="text-gray-400 italic">{answer.status}</span>
                            )}
                          </div>
                        </div>
                      ))}
                      {Object.keys(selectedSession.snapshot.answers).length === 0 && (
                        <div className="text-sm text-gray-400 text-center py-4">
                          No answers collected yet
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Patient Info Card */}
                  {selectedSession.snapshot.patient && (
                    <div className="border-t pt-4">
                      <h3 className="text-lg font-semibold mb-3 text-gray-900">Patient Information</h3>
                      <dl className="grid grid-cols-2 gap-4">
                        <div>
                          <dt className="text-sm text-gray-600">Name</dt>
                          <dd className="text-base font-medium text-gray-900">
                            {selectedSession.snapshot.patient.full_name || '—'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm text-gray-600">DOB</dt>
                          <dd className="text-base font-medium text-gray-900">
                            {selectedSession.snapshot.patient.dob || '—'}
                          </dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="text-sm text-gray-600">Callback</dt>
                          <dd className="text-base font-medium text-gray-900">
                            {selectedSession.snapshot.patient.callback_number || '—'}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  )}

                  {/* Completion Status */}
                  {selectedSession.snapshot.completed && (
                    <div className="bg-green-50 border-l-4 border-green-500 p-4">
                      <div className="flex items-center">
                        <span className="text-2xl mr-2">✅</span>
                        <span className="text-sm font-medium text-green-800">
                          Intake Complete
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-6xl mb-4">👈</div>
                  <p>Select a session to view live details</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border-l-4 border-blue-500 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">💡 Testing Instructions</h3>
          <p className="text-sm text-blue-800 mb-3">
            This dashboard shows real-time updates from the orchestrator via Server-Sent Events (SSE).
          </p>
          <div className="bg-blue-900 text-blue-100 p-3 rounded font-mono text-sm">
            <div># Run normal conversation simulation</div>
            <div>$ make simulate</div>
            <div className="mt-2"># Run red flag detection test</div>
            <div>$ make simulate-red-flag</div>
          </div>
          <p className="text-xs text-blue-600 mt-3">
            Open this dashboard in multiple tabs to see synchronized updates across all viewers.
          </p>
        </div>
      </main>
    </div>
  );
}
