import { describe, it, expect } from 'vitest';
import { hasErrors, requiresRevenue, validateClient } from '../../validation/client.js';
import type { ClientInput } from '../../types.js';

const baseInput: ClientInput = {
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com',
  phone: '+1-555-0199',
  companyName: '',
  clientType: 'Individual',
  status: 'Active',
  industry: 'Other',
  annualRevenue: null,
  notes: '',
};

describe('requiresRevenue', () => {
  it('is true for Business', () => expect(requiresRevenue('Business')).toBe(true));
  it('is true for Enterprise', () => expect(requiresRevenue('Enterprise')).toBe(true));
  it('is false for Individual', () => expect(requiresRevenue('Individual')).toBe(false));
  it('is false for Non-profit', () => expect(requiresRevenue('Non-profit')).toBe(false));
});

describe('validateClient — required fields', () => {
  it('reports each missing required field', () => {
    const errors = validateClient({});
    expect(errors.firstName).toBeDefined();
    expect(errors.lastName).toBeDefined();
    expect(errors.email).toBeDefined();
    expect(errors.phone).toBeDefined();
    expect(errors.clientType).toBeDefined();
  });

  it('passes when all required fields are present', () => {
    expect(hasErrors(validateClient(baseInput))).toBe(false);
  });
});

describe('validateClient — format rules', () => {
  it('rejects malformed email', () => {
    expect(validateClient({ ...baseInput, email: 'not-an-email' }).email).toMatch(/invalid/i);
  });

  it('rejects too-short phone', () => {
    expect(validateClient({ ...baseInput, phone: '123' }).phone).toMatch(/invalid/i);
  });
});

describe('validateClient — conditional revenue rule', () => {
  it('requires annualRevenue when clientType is Business', () => {
    const errors = validateClient({ ...baseInput, clientType: 'Business', companyName: 'Co', annualRevenue: null });
    expect(errors.annualRevenue).toBeDefined();
  });

  it('requires companyName when clientType is Enterprise', () => {
    const errors = validateClient({ ...baseInput, clientType: 'Enterprise', annualRevenue: 100, companyName: '' });
    expect(errors.companyName).toBeDefined();
  });

  it('rejects negative revenue', () => {
    const errors = validateClient({
      ...baseInput,
      clientType: 'Business',
      companyName: 'Co',
      annualRevenue: -10,
    });
    expect(errors.annualRevenue).toMatch(/negative/i);
  });

  it('does not require revenue for Individual', () => {
    expect(validateClient(baseInput).annualRevenue).toBeUndefined();
  });
});
