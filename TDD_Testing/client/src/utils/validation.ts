import type { ClientInput } from '../types';

export type ValidationErrors = Partial<Record<keyof ClientInput, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[\d\s()-]{7,20}$/;

export function requiresRevenue(clientType: string): boolean {
  return clientType === 'Business' || clientType === 'Enterprise';
}

export function validateClient(input: Partial<ClientInput>): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!input.firstName?.trim()) errors.firstName = 'First name is required';
  if (!input.lastName?.trim()) errors.lastName = 'Last name is required';

  if (!input.email?.trim()) errors.email = 'Email is required';
  else if (!EMAIL_RE.test(input.email.trim())) errors.email = 'Email format is invalid';

  if (!input.phone?.trim()) errors.phone = 'Phone is required';
  else if (!PHONE_RE.test(input.phone.trim())) errors.phone = 'Phone format is invalid';

  if (!input.clientType) errors.clientType = 'Client type is required';
  if (!input.status) errors.status = 'Status is required';
  if (!input.industry) errors.industry = 'Industry is required';

  if (input.clientType && requiresRevenue(input.clientType)) {
    if (input.annualRevenue == null || Number.isNaN(input.annualRevenue)) {
      errors.annualRevenue = 'Annual revenue is required for Business/Enterprise clients';
    } else if (input.annualRevenue < 0) {
      errors.annualRevenue = 'Annual revenue cannot be negative';
    }
    if (!input.companyName?.trim()) {
      errors.companyName = 'Company name is required for Business/Enterprise clients';
    }
  }

  return errors;
}

export function hasErrors(errors: ValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}
