import { describe, it, expect } from 'vitest';
import { accountAgeDays, formatCurrency, formatFullName, formatPhone } from '../../utils/format';

describe('formatFullName', () => {
  it('joins first and last with one space', () => {
    expect(formatFullName({ firstName: 'Ada', lastName: 'Lovelace' })).toBe('Ada Lovelace');
  });

  it('trims surrounding whitespace', () => {
    expect(formatFullName({ firstName: ' Ada', lastName: 'Lovelace ' })).toBe('Ada Lovelace');
  });
});

describe('formatPhone', () => {
  it('formats a 10-digit US number', () => {
    expect(formatPhone('5551234567')).toBe('(555) 123-4567');
  });

  it('formats a 1+10-digit US number', () => {
    expect(formatPhone('15551234567')).toBe('+1 (555) 123-4567');
  });

  it('returns the original when it does not match a known shape', () => {
    expect(formatPhone('123')).toBe('123');
  });
});

describe('formatCurrency', () => {
  it('formats numbers as USD with no decimals', () => {
    expect(formatCurrency(250000)).toBe('$250,000');
  });

  it('renders em-dash for null/undefined', () => {
    expect(formatCurrency(null)).toBe('—');
    expect(formatCurrency(undefined)).toBe('—');
  });
});

describe('accountAgeDays', () => {
  it('computes age deterministically with injected now', () => {
    expect(accountAgeDays('2025-01-01T00:00:00.000Z', new Date('2025-01-31T00:00:00.000Z'))).toBe(30);
  });
});
