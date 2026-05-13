export type ClientType = 'Individual' | 'Business' | 'Enterprise' | 'Non-profit';
export type ClientStatus = 'Active' | 'Inactive' | 'Prospect';
export type Industry =
  | 'Technology'
  | 'Healthcare'
  | 'Finance'
  | 'Retail'
  | 'Manufacturing'
  | 'Education'
  | 'Other';

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName: string;
  clientType: ClientType;
  status: ClientStatus;
  industry: Industry;
  annualRevenue: number | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type ClientInput = Omit<Client, 'id' | 'createdAt' | 'updatedAt'>;

export interface Lookups {
  clientTypes: ClientType[];
  statuses: ClientStatus[];
  industries: Industry[];
}

export interface ValidationErrorResponse {
  errors: Partial<Record<keyof ClientInput, string>>;
}
