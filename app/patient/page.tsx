'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Session {
  id: string;
  status: string;
  startTime: string;
  phoneNumber: string;
}

export default function PatientDashboard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessionDetails, setSessionDetails] = useState<any>(null);

  useEffect(() => {
    // In a real app, fetch patient's sessions from API
    // For now, showing mock data
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">Patient Portal</h1>
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
        {/* Welcome Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Welcome to Your Health Portal</h2>
          <p className="text-gray-600 mb-4">
            Access your voice intake sessions, review transcripts, and manage your health information securely.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">📞 Start Voice Intake</h3>
              <p className="text-sm text-blue-700 mb-3">
                Call our system to begin your health intake process
              </p>
              <div className="bg-white p-3 rounded border border-blue-200">
                <p className="text-xs text-gray-600 mb-1">Call:</p>
                <p className="text-lg font-bold text-blue-600">1-800-HEALTH</p>
              </div>
            </div>

            <div className="p-4 bg-green-50 rounded-lg">
              <h3 className="font-semibold text-green-900 mb-2">✓ HIPAA Compliant</h3>
              <p className="text-sm text-green-700">
                Your data is encrypted and securely stored in compliance with HIPAA regulations
              </p>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg">
              <h3 className="font-semibold text-purple-900 mb-2">🤖 AI-Powered</h3>
              <p className="text-sm text-purple-700">
                Natural conversation with empathetic AI that understands your needs
              </p>
            </div>
          </div>
        </div>

        {/* Session History */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold">Your Intake Sessions</h2>
          </div>
          
          <div className="p-6">
            {sessions.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📋</div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  No Sessions Yet
                </h3>
                <p className="text-gray-500 mb-6">
                  Start your first voice intake by calling the number above
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 cursor-pointer transition-colors"
                    onClick={() => setSelectedSession(session.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          Session {session.id.slice(-8)}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {new Date(session.startTime).toLocaleString()}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          session.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {session.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-3">🎯 What We Collect</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Personal information (name, DOB, contact)</li>
              <li>• Chief complaint and symptoms</li>
              <li>• Medication allergies</li>
              <li>• Current medications</li>
              <li>• Medical history</li>
              <li>• Visit reason</li>
            </ul>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-3">🔒 Your Privacy</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• End-to-end encryption</li>
              <li>• HIPAA-compliant storage</li>
              <li>• Secure access controls</li>
              <li>• Audit logging</li>
              <li>• Data retention policies</li>
              <li>• Patient consent management</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
