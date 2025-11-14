import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white">
      <main className="flex flex-col items-center gap-8 p-8 max-w-4xl">
        <h1 className="text-5xl font-bold text-center text-gray-900">
          Empathetic Health Voice Agent
        </h1>
        <p className="text-xl text-center text-gray-600 max-w-2xl">
          HIPAA-compliant AI-powered voice intake system with real-time transcription,
          empathetic dialogue, and comprehensive patient dashboards.
        </p>
        
        <div className="flex gap-4 mt-8">
          <Link
            href="/patient"
            className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg font-semibold"
          >
            Patient Portal
          </Link>
          <Link
            href="/staff"
            className="px-8 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-lg font-semibold"
          >
            Staff Dashboard
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          <div className="p-6 bg-white rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-2">🎙️ Voice Intake</h3>
            <p className="text-gray-600">
              Twilio/Telnyx telephony with Deepgram streaming ASR for real-time transcription
            </p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-2">🤖 AI Dialogue</h3>
            <p className="text-gray-600">
              GPT-4 powered empathetic conversation engine with natural language understanding
            </p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-2">🔊 Natural Speech</h3>
            <p className="text-gray-600">
              ElevenLabs text-to-speech for human-like voice responses
            </p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-2">📝 High Accuracy</h3>
            <p className="text-gray-600">
              TwinMind Ear-3 Pro for post-call transcription corrections
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
