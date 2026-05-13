import type { Client } from '../types';

export function formatFullName(c: Pick<Client, 'firstName' | 'lastName'>): string {
  return `${c.firstName} ${c.lastName}`.trim();
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function accountAgeDays(createdAt: string, now: Date): number {
  const created = new Date(createdAt).getTime();
  const ms = now.getTime() - created;
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}
