import twilio from 'twilio';

export class TwilioService {
  private client;
  private accountSid: string;
  private authToken: string;
  private phoneNumber: string;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = process.env.TWILIO_AUTH_TOKEN || '';
    this.phoneNumber = process.env.TWILIO_PHONE_NUMBER || '';

    if (!this.accountSid || !this.authToken || !this.phoneNumber) {
      throw new Error('Twilio credentials are required');
    }

    this.client = twilio(this.accountSid, this.authToken);
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
    return twilio.validateRequest(
      this.authToken,
      signature,
      url,
      params
    );
  }
}
