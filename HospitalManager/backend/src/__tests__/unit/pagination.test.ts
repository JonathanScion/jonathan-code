import { describe, it, expect } from 'vitest';
import { getPagination, paginatedResponse } from '../../lib/pagination';

// Helper to create a mock Express request
function mockReq(query: Record<string, string> = {}): any {
  return { query };
}

describe('getPagination', () => {
  it('returns defaults when no query params', () => {
    const result = getPagination(mockReq());
    expect(result).toEqual({ page: 1, pageSize: 25, skip: 0, take: 25 });
  });

  it('parses page and pageSize from query', () => {
    const result = getPagination(mockReq({ page: '3', pageSize: '10' }));
    expect(result).toEqual({ page: 3, pageSize: 10, skip: 20, take: 10 });
  });

  it('clamps page to minimum 1', () => {
    const result = getPagination(mockReq({ page: '-5' }));
    expect(result.page).toBe(1);
    expect(result.skip).toBe(0);
  });

  it('clamps page 0 to 1', () => {
    const result = getPagination(mockReq({ page: '0' }));
    expect(result.page).toBe(1);
  });

  it('falls back to default pageSize for 0 (falsy)', () => {
    const result = getPagination(mockReq({ pageSize: '0' }));
    // parseInt('0') || 1 evaluates to 1, then Math.min(100, Math.max(1, 1)) = 1
    // Actually: parseInt('0') = 0, 0 || 1 = 1 (falsy), Math.min(100, Math.max(1, 1)) = 1
    // But the code does: Math.min(100, Math.max(1, parseInt('0') || 25))
    // parseInt('0') = 0, 0 || 25 = 25, Math.max(1, 25) = 25, Math.min(100, 25) = 25
    expect(result.pageSize).toBe(25);
  });

  it('clamps negative pageSize to minimum 1', () => {
    const result = getPagination(mockReq({ pageSize: '-5' }));
    // parseInt('-5') = -5, -5 || 25 = -5 (truthy), Math.max(1, -5) = 1
    expect(result.pageSize).toBe(1);
  });

  it('clamps pageSize to maximum 100', () => {
    const result = getPagination(mockReq({ pageSize: '500' }));
    expect(result.pageSize).toBe(100);
  });

  it('calculates correct skip for page 2', () => {
    const result = getPagination(mockReq({ page: '2', pageSize: '15' }));
    expect(result.skip).toBe(15);
  });

  it('handles NaN values gracefully', () => {
    const result = getPagination(mockReq({ page: 'abc', pageSize: 'xyz' }));
    expect(result).toEqual({ page: 1, pageSize: 25, skip: 0, take: 25 });
  });
});

describe('paginatedResponse', () => {
  it('returns data and pagination metadata', () => {
    const data = [{ id: 1 }, { id: 2 }];
    const result = paginatedResponse(data, 50, 1, 25);
    expect(result).toEqual({
      data,
      pagination: { page: 1, pageSize: 25, total: 50, totalPages: 2 },
    });
  });

  it('calculates totalPages correctly with remainder', () => {
    const result = paginatedResponse([], 51, 1, 25);
    expect(result.pagination.totalPages).toBe(3);
  });

  it('handles zero total', () => {
    const result = paginatedResponse([], 0, 1, 25);
    expect(result.pagination.totalPages).toBe(0);
  });

  it('handles total equal to pageSize', () => {
    const result = paginatedResponse([], 25, 1, 25);
    expect(result.pagination.totalPages).toBe(1);
  });
});
