#!/usr/bin/env node

/**
 * Twilio Call Simulator
 * Simulates Twilio Media Streams for local testing
 * 
 * Usage: node scripts/simulate-call.js
 */

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const CALL_ID = `sim_call_${Date.now()}`;

console.log('🎭 Twilio Call Simulator');
console.log('========================\n');
console.log(`Call ID: ${CALL_ID}`);
console.log(`API Base: ${API_BASE}\n`);

// Simulated conversation
const conversation = [
  {
    speaker: 'agent',
    text: 'Hello! Thank you for calling. I\'m here to help with your medical intake. What is your full name?',
    delay: 2000,
  },
  {
    speaker: 'patient',
    text: 'My name is John Smith',
    delay: 3000,
    confidence: 0.92,
  },
  {
    speaker: 'agent',
    text: 'Thank you, John Smith. What is your date of birth?',
    delay: 2000,
  },
  {
    speaker: 'patient',
    text: 'May 14th, 1982',
    delay: 2500,
    confidence: 0.88,
  },
  {
    speaker: 'agent',
    text: 'Thank you. What is the best phone number to reach you at?',
    delay: 2000,
  },
  {
    speaker: 'patient',
    text: '555-123-4567',
    delay: 2000,
    confidence: 0.95,
  },
  {
    speaker: 'agent',
    text: 'Great. What brings you in today?',
    delay: 2000,
  },
  {
    speaker: 'patient',
    text: 'I\'ve been having a persistent cough for about a week',
    delay: 3500,
    confidence: 0.89,
  },
  {
    speaker: 'agent',
    text: 'I understand. Do you have any allergies to medications?',
    delay: 2000,
  },
  {
    speaker: 'patient',
    text: 'Yes, I\'m allergic to penicillin',
    delay: 2500,
    confidence: 0.91,
  },
  {
    speaker: 'agent',
    text: 'Thank you for letting me know. What medications are you currently taking?',
    delay: 2000,
  },
  {
    speaker: 'patient',
    text: 'I take lisinopril for blood pressure',
    delay: 3000,
    confidence: 0.87,
  },
  {
    speaker: 'agent',
    text: 'Have you experienced these symptoms before?',
    delay: 2000,
  },
  {
    speaker: 'patient',
    text: 'No, this is the first time',
    delay: 2000,
    confidence: 0.93,
  },
];

// Main simulation
async function runSimulation() {
  console.log('Starting call simulation...\n');

  let turnCount = 0;

  for (const turn of conversation) {
    // Wait for delay
    await sleep(turn.delay);

    turnCount++;
    const turnId = `turn_${CALL_ID}_${turnCount}`;

    console.log(`[${turn.speaker.toUpperCase()}] ${turn.text}`);

    // Only send patient turns to API (agent turns are responses)
    if (turn.speaker === 'patient') {
      const transcriptTurn = {
        turn_id: turnId,
        call_id: CALL_ID,
        speaker: turn.speaker,
        text: turn.text,
        start_ms: Date.now() - turn.delay,
        end_ms: Date.now(),
        asr_confidence: turn.confidence || 0.9,
        is_final: true,
      };

      try {
        const response = await fetch(`${API_BASE}/api/v1/transcript`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ turn: transcriptTurn }),
        });

        if (!response.ok) {
          const error = await response.text();
          console.error(`  ❌ API error: ${error}`);
        } else {
          const result = await response.json();
          console.log(`  ✓ Processed (action: ${result.action?.action || 'none'})`);
        }
      } catch (error) {
        console.error(`  ❌ Failed to send transcript:`, error.message);
      }
    }

    console.log('');
  }

  // Get final snapshot
  console.log('\n📊 Fetching final snapshot...\n');
  try {
    const response = await fetch(`${API_BASE}/api/v1/emit_snapshot?call_id=${CALL_ID}`);
    if (response.ok) {
      const data = await response.json();
      console.log('Final IntakeSnapshot:');
      console.log(JSON.stringify(data.snapshot, null, 2));
    } else {
      console.log('No snapshot found (normal if not explicitly emitted)');
    }
  } catch (error) {
    console.error('Failed to fetch snapshot:', error.message);
  }

  // Get transcript
  console.log('\n📝 Fetching full transcript...\n');
  try {
    const response = await fetch(`${API_BASE}/api/v1/transcript?call_id=${CALL_ID}`);
    if (response.ok) {
      const data = await response.json();
      console.log(`Total turns: ${data.count}`);
      console.log('\nTranscript turns:');
      data.turns.forEach((t, i) => {
        console.log(`${i + 1}. [${t.speaker}] ${t.text}`);
      });
    }
  } catch (error) {
    console.error('Failed to fetch transcript:', error.message);
  }

  console.log('\n✅ Simulation complete!');
  console.log(`\nTo view live updates, open: ${API_BASE}/staff`);
}

// Test with red flag scenario
async function runRedFlagSimulation() {
  console.log('🚨 Running RED FLAG simulation...\n');

  const callId = `sim_redflag_${Date.now()}`;

  const turns = [
    {
      speaker: 'patient',
      text: 'I have severe chest pain and I can\'t breathe',
      confidence: 0.94,
    },
  ];

  for (const turn of turns) {
    const turnId = `turn_${callId}_1`;

    console.log(`[PATIENT] ${turn.text}`);

    const transcriptTurn = {
      turn_id: turnId,
      call_id: callId,
      speaker: turn.speaker,
      text: turn.text,
      start_ms: Date.now(),
      end_ms: Date.now(),
      asr_confidence: turn.confidence,
      is_final: true,
    };

    try {
      const response = await fetch(`${API_BASE}/api/v1/transcript`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ turn: transcriptTurn }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`\n✓ Response:`, result);
        
        if (result.action?.action === 'request_handoff') {
          console.log('\n🚨 RED FLAG DETECTED! Handoff requested.');
          console.log(`   Reason: ${result.action.data.reason}`);
          console.log(`   Priority: ${result.action.data.priority}`);
        }
      }
    } catch (error) {
      console.error('Error:', error.message);
    }
  }

  console.log('\n✅ Red flag simulation complete!');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Parse command line args
const args = process.argv.slice(2);

if (args.includes('--red-flag')) {
  runRedFlagSimulation();
} else if (args.includes('--help')) {
  console.log('Usage: node scripts/simulate-call.js [options]');
  console.log('\nOptions:');
  console.log('  --red-flag    Run red flag detection scenario');
  console.log('  --help        Show this help message');
  console.log('\nEnvironment variables:');
  console.log('  API_BASE      Base URL for API (default: http://localhost:3000)');
} else {
  runSimulation();
}
