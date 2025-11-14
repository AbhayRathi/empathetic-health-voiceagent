# Deployment Guide

This guide covers deploying the Empathetic Health Voice Agent to production.

## Prerequisites

Before deploying, ensure you have:

1. **API Keys** for all services:
   - Twilio or Telnyx (telephony)
   - Deepgram (ASR)
   - OpenAI (GPT-4)
   - ElevenLabs (TTS)
   - TwinMind (optional, for corrections)

2. **Production infrastructure**:
   - HTTPS-enabled domain
   - SSL certificates
   - Database (PostgreSQL recommended for HIPAA compliance)
   - Redis or similar for session state (optional but recommended)

3. **HIPAA Compliance Requirements**:
   - BAA (Business Associate Agreement) with all third-party services
   - Encrypted storage
   - Audit logging
   - Access controls

## Deployment Platforms

### Option 1: Vercel (Recommended)

Vercel provides the easiest deployment for Next.js applications:

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Deploy:
```bash
vercel
```

3. Configure environment variables in Vercel dashboard:
   - Go to Project Settings → Environment Variables
   - Add all variables from `.env.example`

4. Configure custom domain and SSL

**Limitations**: 
- Vercel has limited support for WebSocket connections
- May need separate WebSocket server

### Option 2: AWS (Production-Ready)

For production HIPAA compliance, AWS is recommended:

#### Architecture:
```
Internet Gateway
    ↓
Application Load Balancer (HTTPS)
    ↓
ECS/Fargate (Next.js app)
    ↓
RDS PostgreSQL (encrypted)
    ↓
ElastiCache Redis (session state)
```

#### Deployment Steps:

1. **Create ECR Repository**:
```bash
aws ecr create-repository --repository-name empathetic-health-voice
```

2. **Build and Push Docker Image**:
```bash
# Create Dockerfile
docker build -t empathetic-health-voice .
docker tag empathetic-health-voice:latest <ecr-url>/empathetic-health-voice:latest
docker push <ecr-url>/empathetic-health-voice:latest
```

3. **Create ECS Cluster**:
```bash
aws ecs create-cluster --cluster-name health-voice-cluster
```

4. **Configure RDS**:
- Enable encryption at rest
- Enable automated backups
- Configure VPC security groups
- Set up IAM authentication

5. **Deploy to ECS**:
- Create task definition
- Set environment variables
- Configure health checks
- Set up auto-scaling

### Option 3: Google Cloud Run

Cloud Run provides serverless container deployment:

1. **Build container**:
```bash
gcloud builds submit --tag gcr.io/PROJECT-ID/health-voice
```

2. **Deploy**:
```bash
gcloud run deploy health-voice \
  --image gcr.io/PROJECT-ID/health-voice \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

3. **Set environment variables**:
```bash
gcloud run services update health-voice \
  --set-env-vars DEEPGRAM_API_KEY=xxx,OPENAI_API_KEY=yyy
```

## Environment Configuration

### Production Environment Variables

Create `.env.production`:

```env
# Telephony
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_PHONE_NUMBER=+1234567890

# ASR & Transcription
DEEPGRAM_API_KEY=xxxxx
TWINMIND_API_KEY=xxxxx

# LLM
OPENAI_API_KEY=sk-xxxxx

# TTS
ELEVENLABS_API_KEY=xxxxx
ELEVENLABS_VOICE_ID=xxxxx

# Application
NEXT_PUBLIC_APP_URL=https://yourapp.com
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Security
ENCRYPTION_KEY=xxxxx
JWT_SECRET=xxxxx
NODE_ENV=production
```

## Database Setup

For production, set up PostgreSQL with:

1. **Schema**:
```sql
CREATE TABLE sessions (
  id VARCHAR(255) PRIMARY KEY,
  patient_id VARCHAR(255),
  phone_number VARCHAR(20),
  call_sid VARCHAR(255),
  status VARCHAR(50),
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  transcript JSONB,
  snapshot JSONB,
  audio_recording_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_patient ON sessions(patient_id);
CREATE INDEX idx_sessions_call_sid ON sessions(call_sid);
CREATE INDEX idx_sessions_status ON sessions(status);

-- Audit logging table
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  action VARCHAR(50),
  user_id VARCHAR(255),
  resource_type VARCHAR(50),
  resource_id VARCHAR(255),
  ip_address INET,
  successful BOOLEAN
);

CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
```

2. **Enable encryption at rest**
3. **Configure automated backups**
4. **Set up replication for high availability**

## Twilio Configuration

1. **Purchase phone number** in Twilio Console

2. **Configure webhooks**:
   - Voice & Fax → Configure
   - When a call comes in: `https://yourapp.com/api/telephony/incoming` (HTTP POST)
   - Call Status Changes: `https://yourapp.com/api/telephony/status` (HTTP POST)

3. **Enable recording** (optional):
   - Configure recording callback URL
   - Set retention policy

4. **Configure Media Streams**:
   - Enable for WebSocket audio streaming
   - Set stream URL pattern

## Security Checklist

Before going live:

- [ ] SSL/TLS certificates installed and configured
- [ ] All environment variables secured
- [ ] Database encryption at rest enabled
- [ ] Database encryption in transit enabled
- [ ] Audit logging implemented
- [ ] Access controls configured
- [ ] Rate limiting implemented
- [ ] Input validation on all endpoints
- [ ] CORS properly configured
- [ ] CSP headers set
- [ ] API keys rotated to production values
- [ ] BAA signed with all third parties
- [ ] Data retention policies configured
- [ ] Backup and disaster recovery plan in place
- [ ] Monitoring and alerting configured
- [ ] HIPAA compliance audit completed

## Monitoring

Set up monitoring for:

1. **Application metrics**:
   - Request rate
   - Error rate
   - Response time
   - API call volumes

2. **Business metrics**:
   - Active sessions
   - Completed sessions
   - Average session duration
   - Transcription accuracy

3. **Infrastructure metrics**:
   - CPU/Memory usage
   - Database connections
   - Disk usage
   - Network throughput

## Recommended Tools:

- **APM**: Datadog, New Relic, or AWS CloudWatch
- **Logging**: CloudWatch Logs, Papertrail
- **Error Tracking**: Sentry
- **Uptime Monitoring**: Pingdom, UptimeRobot

## Scaling Considerations

1. **Horizontal scaling**:
   - Use load balancer
   - Run multiple app instances
   - Implement session affinity if needed

2. **Database scaling**:
   - Read replicas for reporting
   - Connection pooling
   - Query optimization

3. **Caching**:
   - Redis for session state
   - CloudFront/CDN for static assets
   - API response caching where appropriate

## Backup and Recovery

1. **Automated backups**:
   - Database: Daily snapshots, 30-day retention
   - File storage: Continuous replication
   - Configuration: Version controlled in git

2. **Disaster recovery plan**:
   - RTO (Recovery Time Objective): < 4 hours
   - RPO (Recovery Point Objective): < 1 hour
   - Regular restore testing

## Post-Deployment

After deployment:

1. **Test all critical paths**:
   - Make test phone call
   - Verify transcription works
   - Check AI responses
   - Verify TTS playback
   - Test dashboard access

2. **Monitor for issues**:
   - Check error logs
   - Monitor API rate limits
   - Verify webhook deliveries

3. **Gradual rollout**:
   - Start with limited users
   - Monitor performance
   - Scale up gradually

## Support and Maintenance

- Monitor API service status pages
- Keep dependencies updated
- Regular security audits
- Performance optimization
- User feedback collection
