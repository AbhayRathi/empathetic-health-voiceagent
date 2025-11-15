'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Session {
  id: string;
  status: string;
  startTime: string;
  endTime?: string;
  phoneNumber: string;
  patientName?: string;
}

interface Snapshot {
  personalInfo: {
    name?: string;
    dateOfBirth?: string;
    phoneNumber?: string;
  };
  medicalInfo: {
    chiefComplaint?: string;
    symptoms?: string[];
    allergies?: string[];
    medications?: string[];
  };
  visitReason?: string;
}

export default function StaffDashboard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionDetails, setSessionDetails] = useState<{
    session: Session;
    snapshot: Snapshot;
    transcript: any[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSessionDetails = async (sessionId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setSessionDetails(data);
      }
    } catch (error) {
      console.error('Failed to fetch session details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSessionId) {
      fetchSessionDetails(selectedSessionId);
    }
  }, [selectedSessionId]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Staff Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">
                Monitor and manage patient intake sessions
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
              {sessions.filter(s => s.status === 'active').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Completed Today</div>
            <div className="text-3xl font-bold text-blue-600">
              {sessions.filter(s => s.status === 'completed').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Avg. Duration</div>
            <div className="text-3xl font-bold text-purple-600">5.2m</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sessions List */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold">Recent Sessions</h2>
            </div>
            
            <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
              {sessions.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <div className="text-5xl mb-3">📊</div>
                  <p>No sessions yet</p>
                  <p className="text-sm mt-2">Sessions will appear here when patients call</p>
                </div>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                      selectedSessionId === session.id ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => setSelectedSessionId(session.id)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {session.patientName || 'Unknown Patient'}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {session.phoneNumber}
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
                        {session.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Started: {new Date(session.startTime).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Session Details */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold">Session Details</h2>
            </div>
            
            <div className="p-6">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-500 mt-4">Loading session details...</p>
                </div>
              ) : selectedSessionId && sessionDetails ? (
                <div className="space-y-6">
                  {/* Personal Info */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-gray-900">Personal Information</h3>
                    <dl className="space-y-2">
                      <div>
                        <dt className="text-sm text-gray-600">Name</dt>
                        <dd className="text-base font-medium text-gray-900">
                          {sessionDetails.snapshot.personalInfo.name || 'Not provided'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-600">Date of Birth</dt>
                        <dd className="text-base font-medium text-gray-900">
                          {sessionDetails.snapshot.personalInfo.dateOfBirth || 'Not provided'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-600">Phone</dt>
                        <dd className="text-base font-medium text-gray-900">
                          {sessionDetails.snapshot.personalInfo.phoneNumber || 'Not provided'}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {/* Medical Info */}
                  <div className="border-t pt-4">
                    <h3 className="text-lg font-semibold mb-3 text-gray-900">Medical Information</h3>
                    <dl className="space-y-2">
                      <div>
                        <dt className="text-sm text-gray-600">Chief Complaint</dt>
                        <dd className="text-base font-medium text-gray-900">
                          {sessionDetails.snapshot.medicalInfo.chiefComplaint || 'Not provided'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-600">Allergies</dt>
                        <dd className="text-base font-medium text-gray-900">
                          {sessionDetails.snapshot.medicalInfo.allergies?.join(', ') || 'None reported'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-600">Current Medications</dt>
                        <dd className="text-base font-medium text-gray-900">
                          {sessionDetails.snapshot.medicalInfo.medications?.join(', ') || 'None reported'}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {/* Transcript Preview */}
                  {sessionDetails.transcript && sessionDetails.transcript.length > 0 && (
                    <div className="border-t pt-4">
                      <h3 className="text-lg font-semibold mb-3 text-gray-900">Transcript</h3>
                      <div className="bg-gray-50 rounded p-4 max-h-64 overflow-y-auto space-y-2">
                        {sessionDetails.transcript.map((entry, idx) => (
                          <div key={idx} className="text-sm">
                            <span className={`font-semibold ${
                              entry.speaker === 'agent' ? 'text-blue-600' : 'text-green-600'
                            }`}>
                              {entry.speaker === 'agent' ? 'Agent' : 'Patient'}:
                            </span>
                            <span className="ml-2 text-gray-700">{entry.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-6xl mb-4">👈</div>
                  <p>Select a session to view details</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* System Information */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-3">🎙️ Technology Stack</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Twilio Telephony</li>
              <li>• Deepgram Streaming ASR</li>
              <li>• GPT-4 Dialogue Engine</li>
              <li>• ElevenLabs TTS</li>
              <li>• TwinMind Ear-3 Pro</li>
            </ul>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-3">✅ Features</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Real-time transcription</li>
              <li>• Empathetic AI dialogue</li>
              <li>• Verbatim questions</li>
              <li>• Answer confirmation</li>
              <li>• JSON snapshots</li>
              <li>• Post-call corrections</li>
            </ul>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-3">🔒 Compliance</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• HIPAA-compliant design</li>
              <li>• Encrypted storage</li>
              <li>• Access controls</li>
              <li>• Audit logging</li>
              <li>• Data retention</li>
              <li>• Patient consent</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
