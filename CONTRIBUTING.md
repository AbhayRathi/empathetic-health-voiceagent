# Contributing Guide

Thank you for your interest in contributing to the Empathetic Health Voice Agent! This guide will help you get started.

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Maintain patient privacy and HIPAA compliance
- Follow security best practices

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Create a new branch for your feature
4. Make your changes
5. Test thoroughly
6. Submit a pull request

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/empathetic-health-voiceagent.git
cd empathetic-health-voiceagent

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Start development server
npm run dev
```

## Project Structure

```
empathetic-health-voiceagent/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── patient/           # Patient portal pages
│   ├── staff/             # Staff dashboard pages
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── lib/                   # Core library code
│   ├── services/          # Service integrations
│   ├── types/             # TypeScript definitions
│   └── utils/             # Utility functions
├── components/            # React components
└── public/               # Static assets
```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Define proper types, avoid `any`
- Use interfaces for data structures
- Document complex functions with JSDoc

Example:
```typescript
/**
 * Process patient transcript and extract information
 * @param transcript - Raw transcript text
 * @returns Structured patient information
 */
async function processTranscript(transcript: string): Promise<PatientInfo> {
  // Implementation
}
```

### React Components

- Use functional components with hooks
- Keep components focused and small
- Use meaningful prop names
- Handle loading and error states

Example:
```typescript
interface SessionCardProps {
  session: VoiceSession;
  onSelect: (id: string) => void;
}

export function SessionCard({ session, onSelect }: SessionCardProps) {
  // Component implementation
}
```

### API Routes

- Validate all inputs
- Handle errors gracefully
- Return consistent response formats
- Log important events

Example:
```typescript
export async function POST(request: NextRequest) {
  try {
    // Validate input
    const data = await request.json();
    if (!data.sessionId) {
      return NextResponse.json(
        { error: 'sessionId required' },
        { status: 400 }
      );
    }
    
    // Process request
    const result = await processSession(data.sessionId);
    
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Testing

### Running Tests

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Build test
npm run build
```

### Writing Tests

Currently, the project doesn't have a test suite. Contributions to add testing are welcome!

When adding tests:
- Use Jest for unit tests
- Use React Testing Library for component tests
- Mock external API calls
- Test error scenarios

## HIPAA Compliance

**Critical**: All contributions must maintain HIPAA compliance.

### Guidelines:

1. **Never log PHI** (Protected Health Information)
   ```typescript
   // ❌ BAD
   console.log('Patient data:', patientData);
   
   // ✅ GOOD
   console.log('Processing session:', sanitizeForLogging(sessionId));
   ```

2. **Encrypt sensitive data**
   ```typescript
   // Always encrypt before storing
   const encrypted = encryptData(sensitiveData, encryptionKey);
   ```

3. **Validate inputs** to prevent injection attacks
   ```typescript
   function validatePhoneNumber(phone: string): boolean {
     return /^\+?[1-9]\d{1,14}$/.test(phone);
   }
   ```

4. **Use secure communication** (HTTPS/WSS only in production)

5. **Implement audit logging**
   ```typescript
   logAuditEvent({
     action: 'access',
     userId: userId,
     resourceType: 'session',
     resourceId: sessionId,
   });
   ```

## Security Best Practices

1. **Never commit secrets**
   - Use `.env.local` for local development
   - Never commit `.env.local`
   - Use environment variables for all credentials

2. **Validate all inputs**
   ```typescript
   function sanitizeInput(input: string): string {
     return input.trim().replace(/[<>]/g, '');
   }
   ```

3. **Use parameterized queries** (when adding database)
   ```typescript
   // ❌ BAD
   const query = `SELECT * FROM sessions WHERE id = '${sessionId}'`;
   
   // ✅ GOOD
   const query = 'SELECT * FROM sessions WHERE id = $1';
   const result = await db.query(query, [sessionId]);
   ```

4. **Implement rate limiting**
5. **Keep dependencies updated**

## Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clear, focused commits
   - Follow coding standards
   - Add tests if applicable
   - Update documentation

3. **Test your changes**
   ```bash
   npm run type-check
   npm run build
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "Add feature: description"
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Open a Pull Request**
   - Describe what you changed and why
   - Reference any related issues
   - Include screenshots for UI changes
   - Wait for review

### PR Checklist

Before submitting:

- [ ] Code follows project style guidelines
- [ ] TypeScript types are properly defined
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] Build succeeds (`npm run build`)
- [ ] HIPAA compliance maintained
- [ ] No security vulnerabilities introduced
- [ ] Documentation updated if needed
- [ ] Commit messages are clear
- [ ] No secrets or credentials committed

## Feature Requests

To request a new feature:

1. Check if it already exists in issues
2. Open a new issue with:
   - Clear description of the feature
   - Use case / why it's needed
   - Proposed implementation (optional)
   - Any HIPAA considerations

## Bug Reports

To report a bug:

1. Check if it's already reported
2. Open a new issue with:
   - Description of the bug
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node version, etc.)
   - Screenshots if applicable
   - **Do NOT include PHI in bug reports**

## Areas for Contribution

We welcome contributions in these areas:

### High Priority

- [ ] Database integration (PostgreSQL)
- [ ] WebSocket server implementation
- [ ] Authentication and authorization
- [ ] Test suite (Jest, React Testing Library)
- [ ] Error monitoring integration (Sentry)
- [ ] Audit logging system

### Medium Priority

- [ ] Additional LLM providers (Claude, Llama)
- [ ] Alternative TTS providers
- [ ] Multi-language support
- [ ] Advanced analytics dashboard
- [ ] Export functionality (PDF, CSV)
- [ ] EHR integration adapters

### Nice to Have

- [ ] Mobile app (React Native)
- [ ] Voice activity detection
- [ ] Sentiment analysis
- [ ] Custom voice training
- [ ] Appointment scheduling integration
- [ ] SMS notifications

## Documentation

When adding features, update:

- README.md - Overview and setup
- API.md - API endpoints and examples
- DEPLOYMENT.md - Production setup steps
- This file (CONTRIBUTING.md)

Use clear, concise language and include code examples.

## Service Integration Guidelines

When adding a new service integration:

1. Create a new file in `lib/services/`
2. Export a class with a clear interface
3. Handle errors gracefully
4. Use environment variables for configuration
5. Add TypeScript types
6. Document all public methods

Example:
```typescript
export class NewService {
  private apiKey: string;
  
  constructor() {
    this.apiKey = process.env.NEW_SERVICE_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('NEW_SERVICE_API_KEY is required');
    }
  }
  
  /**
   * Do something with the service
   */
  async doSomething(input: string): Promise<Result> {
    try {
      // Implementation
    } catch (error) {
      console.error('Service error:', error);
      throw error;
    }
  }
}
```

## Questions?

- Open a GitHub issue
- Check existing documentation
- Review closed issues and PRs

## License

By contributing, you agree that your contributions will be licensed under the ISC License.

---

Thank you for contributing to make healthcare more accessible and empathetic! 🙏
