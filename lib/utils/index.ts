/**
 * Utility functions for the voice agent application
 */

/**
 * Format phone number to E.164 format
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Add +1 for US numbers if not present
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }
  
  return `+${cleaned}`;
}

/**
 * Sanitize text for HIPAA compliance
 * Remove or mask sensitive information
 */
export function sanitizeForLogging(text: string): string {
  // Mask phone numbers
  let sanitized = text.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, 'XXX-XXX-XXXX');
  
  // Mask SSN
  sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, 'XXX-XX-XXXX');
  
  // Mask email addresses
  sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, 'xxx@xxx.xxx');
  
  return sanitized;
}

/**
 * Generate unique session ID
 */
export function generateSessionId(prefix: string = 'session'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Calculate session duration in minutes
 */
export function calculateDuration(startTime: Date, endTime?: Date): number {
  const end = endTime || new Date();
  const diff = end.getTime() - startTime.getTime();
  return Math.round(diff / 1000 / 60); // Convert to minutes
}

/**
 * Validate date of birth format
 */
export function validateDateOfBirth(dob: string): boolean {
  // Accepts formats: MM/DD/YYYY, MM-DD-YYYY, YYYY-MM-DD
  const patterns = [
    /^\d{2}\/\d{2}\/\d{4}$/,
    /^\d{2}-\d{2}-\d{4}$/,
    /^\d{4}-\d{2}-\d{2}$/,
  ];
  
  return patterns.some(pattern => pattern.test(dob));
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/**
 * Check if text contains medical keywords
 */
export function containsMedicalInfo(text: string): boolean {
  const medicalKeywords = [
    'allerg',
    'medicat',
    'prescri',
    'symptom',
    'pain',
    'diagnosis',
    'treatment',
    'doctor',
    'hospital',
    'condition',
  ];
  
  const lowercaseText = text.toLowerCase();
  return medicalKeywords.some(keyword => lowercaseText.includes(keyword));
}

/**
 * Encrypt sensitive data (placeholder - implement with proper encryption library)
 */
export function encryptData(data: string, key: string): string {
  // TODO: Implement proper encryption using crypto library
  // For now, this is a placeholder
  return Buffer.from(data).toString('base64');
}

/**
 * Decrypt sensitive data (placeholder - implement with proper encryption library)
 */
export function decryptData(encryptedData: string, key: string): string {
  // TODO: Implement proper decryption using crypto library
  // For now, this is a placeholder
  return Buffer.from(encryptedData, 'base64').toString('utf-8');
}

/**
 * Validate required fields in snapshot
 */
export function validateSnapshot(snapshot: any): {
  isComplete: boolean;
  missingFields: string[];
} {
  const requiredFields = [
    'personalInfo.name',
    'personalInfo.dateOfBirth',
    'medicalInfo.chiefComplaint',
    'medicalInfo.allergies',
    'medicalInfo.medications',
  ];
  
  const missingFields: string[] = [];
  
  for (const field of requiredFields) {
    const parts = field.split('.');
    let value = snapshot;
    
    for (const part of parts) {
      value = value?.[part];
    }
    
    if (!value) {
      missingFields.push(field);
    }
  }
  
  return {
    isComplete: missingFields.length === 0,
    missingFields,
  };
}
