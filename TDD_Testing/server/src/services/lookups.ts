import { CLIENT_STATUSES, CLIENT_TYPES, INDUSTRIES, type Lookups } from '../types.js';

export function getLookups(): Lookups {
  return {
    clientTypes: [...CLIENT_TYPES],
    statuses: [...CLIENT_STATUSES],
    industries: [...INDUSTRIES],
  };
}
