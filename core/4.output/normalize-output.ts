const NEUTRAL_ALIASES = [
  'none',
  'wait',
  'hold',
  'no_trade'
];

export function normalizeDirection(
  direction: string
): 'bullish' | 'bearish' | 'neutral' {

  if (!direction) {
    return 'neutral';
  }

  const normalized =
    direction.toLowerCase();

  if (normalized === 'long') {
    return 'bullish';
  }

  if (normalized === 'short') {
    return 'bearish';
  }

  if (
    NEUTRAL_ALIASES.includes(
      normalized
    )
  ) {
    return 'neutral';
  }

  return normalized as
    | 'bullish'
    | 'bearish'
    | 'neutral';
}

export function normalizeConfidence(
  confidence: any
): number {

  if (typeof confidence === 'string') {
    const parsed =
      parseFloat(confidence);

    return isNaN(parsed)
      ? 0
      : parsed;
  }

  return confidence;
}