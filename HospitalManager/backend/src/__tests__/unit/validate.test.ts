import { describe, it, expect, vi } from 'vitest';
import { validate } from '../../middleware/validate';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive(),
});

function mockReq(body: any): any {
  return { body };
}

function mockRes(): any {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe('validate middleware', () => {
  it('passes valid data and calls next', () => {
    const req = mockReq({ name: 'John', age: 30 });
    const res = mockRes();
    const next = vi.fn();
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ name: 'John', age: 30 });
  });

  it('strips unknown fields (Zod default strip behavior)', () => {
    const req = mockReq({ name: 'Jane', age: 25, extra: 'field' });
    const res = mockRes();
    const next = vi.fn();
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ name: 'Jane', age: 25 });
  });

  it('throws ZodError for invalid data', () => {
    const req = mockReq({ name: '', age: -1 });
    const res = mockRes();
    const next = vi.fn();
    expect(() => validate(schema)(req, res, next)).toThrow();
    expect(next).not.toHaveBeenCalled();
  });
});
