import twilio from 'twilio';

export class TwilioService {
  private client: any;
  private accountSid: string;
  private authToken: string;
  private phoneNumber: string;
  private isDeveloperMode: boolean;

  constructor() {
    this.isDeveloperMode = process.env.DEVELOPER_MODE === 'true';
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = process.env.TWILIO_AUTH_TOKEN || '';
    this.phoneNumber = process.env.TWILIO_PHONE_NUMBER || '';

    if (!this.isDeveloperMode && (!this.accountSid || !this.authToken || !this.phoneNumber)) {
      console.warn('Twilio credentials not set and DEVELOPER_MODE is false. Falling back to mock mode.');
      this.isDeveloperMode = true;
    }

    if (!this.isDeveloperMode) {
      this.client = twilio(this.accountSid, this.authToken);
    }
  }

  /**
   * Generate TwiML response for incoming call
   */
  generateTwiMLForIncoming(websocketUrl: string): string {
    const twiml = new twilio.twiml.VoiceResponse();
    
    // Connect to WebSocket for streaming
    const connect = twiml.connect();
    connect.stream({
      url: websocketUrl,
    });

    return twiml.toString();
  }

  /**
   * Make an outbound call
   */
  async makeCall(to: string, websocketUrl: string): Promise<string> {
    if (this.isDeveloperMode) {
      const mockCallSid = `CA_mock_${Date.now()}`;
      console.log(`[Twilio Mock] Outbound call to ${to}, CallSid: ${mockCallSid}`);
      return mockCallSid;
    }

    try {
      const call = await this.client.calls.create({
        to,
        from: this.phoneNumber,
        twiml: this.generateTwiMLForIncoming(websocketUrl),
      });

      return call.sid;
    } catch (error) {
      console.error('Failed to make call:', error);
      throw error;
    }
  }

  /**
   * Get call details
   */
  async getCallDetails(callSid: string) {
    if (this.isDeveloperMode) {
      return {
        sid: callSid,
        from: '+15551234567',
        to: '+15559876543',
        status: 'in-progress',
        duration: null,
        startTime: new Date(),
        endTime: null,
      };
    }

    try {
      const call = await this.client.calls(callSid).fetch();
      return {
        sid: call.sid,
        from: call.from,
        to: call.to,
        status: call.status,
        duration: call.duration,
        startTime: call.startTime,
        endTime: call.endTime,
      };
    } catch (error) {
      console.error('Failed to fetch call details:', error);
      throw error;
    }
  }

  /**
   * Get recording URL for a call
   */
  async getRecordingUrl(callSid: string): Promise<string | null> {
    if (this.isDeveloperMode) {
      console.log(`[Twilio Mock] Recording requested for ${callSid}`);
      return null;
    }

    try {
      const recordings = await this.client.recordings.list({ callSid, limit: 1 });
      
      if (recordings.length > 0) {
        return `https://api.twilio.com${recordings[0].uri.replace('.json', '.mp3')}`;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to fetch recording:', error);
      return null;
    }
  }

  /**
   * End an active call
   */
  async endCall(callSid: string): Promise<void> {
    if (this.isDeveloperMode) {
      console.log(`[Twilio Mock] Ending call ${callSid}`);
      return;
    }

    try {
      await this.client.calls(callSid).update({ status: 'completed' });
    } catch (error) {
      console.error('Failed to end call:', error);
      throw error;
    }
  }

  /**
   * Validate Twilio request signature
   */
  validateRequest(url: string, params: any, signature: string): boolean {
    if (this.isDeveloperMode) {
      console.log('[Twilio Mock] Signature validation skipped in developer mode');
      return true;
    }

    return twilio.validateRequest(
      this.authToken,
      signature,
      url,
      params
    );
  }
}
