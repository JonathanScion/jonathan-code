import { describe, it, expect } from 'vitest';
import { hasErrors, requiresRevenue, validateClient } from '../../utils/validation';
import type { ClientInput } from '../../types';

const base: ClientInput = {
  firstName: 'A',
  lastName: 'B',
  email: 'a@b.com',
  phone: '+1-555-0100',
  companyName: '',
  clientType: 'Individual',
  status: 'Active',
  industry: 'Other',
  annualRevenue: null,
  notes: '',
};

describe('requiresRevenue (client)', () => {
  it.each([
    ['Business', true],
    ['Enterprise', true],
    ['Individual', false],
    ['Non-profit', false],
  ])('%s -> %s', (type, expected) => {
    expect(requiresRevenue(type)).toBe(expected);
  });
});

describe('validateClient (client)', () => {
  it('passes with valid Individual', () => {
    expect(hasErrors(validateClient(base))).toBe(false);
  });

  it('fails when Business is missing revenue and company', () => {
    const errors = validateClient({ ...base, clientType: 'Business' });
    expect(errors.annualRevenue).toBeDefined();
    expect(errors.companyName).toBeDefined();
  });

  it('flags malformed email', () => {
    expect(validateClient({ ...base, email: 'nope' }).email).toMatch(/invalid/i);
  });
});
