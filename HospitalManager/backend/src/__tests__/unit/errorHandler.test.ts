import { describe, it, expect, vi } from 'vitest';
import { AppError, errorHandler } from '../../middleware/errorHandler';
import { ZodError, ZodIssue } from 'zod';
import { Prisma } from '@prisma/client';

function mockRes() {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
}

const mockReq = {} as any;
const mockNext = vi.fn();

describe('errorHandler', () => {
  it('handles AppError with custom status code', () => {
    const res = mockRes();
    const err = new AppError('Not found', 404);
    errorHandler(err, mockReq, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
  });

  it('handles AppError with 400 status', () => {
    const res = mockRes();
    const err = new AppError('Bad request', 400);
    errorHandler(err, mockReq, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Bad request' });
  });

  it('handles ZodError with validation details', () => {
    const res = mockRes();
    const issues: ZodIssue[] = [
      { code: 'invalid_type', expected: 'string', received: 'number', path: ['name'], message: 'Expected string' },
      { code: 'too_small', minimum: 1, type: 'string', inclusive: true, exact: false, path: ['email'], message: 'Required' },
    ];
    const err = new ZodError(issues);
    errorHandler(err, mockReq, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Validation error',
      details: [
        { path: 'name', message: 'Expected string' },
        { path: 'email', message: 'Required' },
      ],
    });
  });

  it('handles Prisma P2002 unique constraint violation', () => {
    const res = mockRes();
    const err = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
      code: 'P2002',
      clientVersion: '5.0.0',
      meta: { target: ['email'] },
    });
    errorHandler(err, mockReq, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Unique constraint violation on email',
    });
  });

  it('handles Prisma P2025 record not found', () => {
    const res = mockRes();
    const err = new Prisma.PrismaClientKnownRequestError('Not found', {
      code: 'P2025',
      clientVersion: '5.0.0',
    });
    errorHandler(err, mockReq, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Record not found' });
  });

  it('handles Prisma P2003 foreign key constraint', () => {
    const res = mockRes();
    const err = new Prisma.PrismaClientKnownRequestError('FK failed', {
      code: 'P2003',
      clientVersion: '5.0.0',
    });
    errorHandler(err, mockReq, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Foreign key constraint failed' });
  });

  it('handles unknown Prisma error codes', () => {
    const res = mockRes();
    const err = new Prisma.PrismaClientKnownRequestError('Unknown', {
      code: 'P2001',
      clientVersion: '5.0.0',
    });
    errorHandler(err, mockReq, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Database error: P2001' });
  });

  it('handles generic errors with 500 status', () => {
    const res = mockRes();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('Something broke');
    errorHandler(err, mockReq, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    consoleSpy.mockRestore();
  });
});

describe('AppError', () => {
  it('extends Error with statusCode', () => {
    const err = new AppError('test', 422);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('test');
    expect(err.statusCode).toBe(422);
  });
});
