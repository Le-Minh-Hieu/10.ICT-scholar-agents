/**
 * Recursively traverses an object and replaces base64 image data strings
 * with a placeholder to prevent log flooding.
 */
export function sanitizeImageLog(obj: any): any {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj !== 'object') {
    if (typeof obj === 'string' && obj.startsWith('data:image/')) {
      return '[IMAGE_DATA]';
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeImageLog(item));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeImageLog(value);
  }
  return sanitized;
}

/**
 * Recursively traverses an object and truncates long strings.
 */
export function truncateLongStrings(obj: any, limit: number = 500): any {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return obj.length > limit ? obj.substring(0, limit) + '... [TRUNCATED]' : obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => truncateLongStrings(item, limit));
  }

  if (typeof obj === 'object') {
    const truncated: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      truncated[key] = truncateLongStrings(value, limit);
    }
    return truncated;
  }

  return obj;
}
