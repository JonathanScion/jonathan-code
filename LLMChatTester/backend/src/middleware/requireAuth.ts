import { Request, Response, NextFunction } from 'express';
import { verifyToken, JWTPayload } from '../services/auth.js';

// Extend Express Request type to include user
export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  (req as AuthenticatedRequest).user = payload;
  next();
}

// Optional auth - sets req.user if token exists, but doesn't require it
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      (req as AuthenticatedRequest).user = payload;
    }
  }

  next();
}

// Helper to get user from request (for use in routes)
export function getUser(req: Request): JWTPayload | undefined {
  return (req as AuthenticatedRequest).user;
}
