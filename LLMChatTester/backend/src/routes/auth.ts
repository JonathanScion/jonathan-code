import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import { getDb, users, collections } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { generateToken } from '../services/auth.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/requireAuth.js';
import { deleteUserNamespace, isPineconeEnabled } from '../services/pinecone.js';
import { deleteUserFiles } from '../services/fileStorage.js';

export const authRouter = Router();

// Store for OAuth state
interface OAuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

// Initialize Passport Google Strategy
export function initPassport() {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackURL = process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback';

  if (!clientID || !clientSecret) {
    console.warn('Google OAuth not configured - GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing');
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL,
      },
      async (
        _accessToken: string,
        _refreshToken: string,
        profile: Profile,
        done: (error: Error | null, user?: OAuthUser) => void
      ) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error('No email from Google'));
          }

          const db = getDb();

          // Find or create user
          let user = await db.query.users.findFirst({
            where: eq(users.email, email),
          });

          if (!user) {
            // Create new user
            const [newUser] = await db
              .insert(users)
              .values({
                email,
                name: profile.displayName || null,
                avatarUrl: profile.photos?.[0]?.value || null,
                provider: 'google',
                providerId: profile.id,
              })
              .returning();

            // Create default collection for the new user
            await db.insert(collections).values({
              userId: newUser.id,
              name: 'Default',
            });

            user = newUser;
            console.log(`New user created: ${email}`);
          } else {
            // Update last login
            await db
              .update(users)
              .set({ lastLoginAt: new Date() })
              .where(eq(users.id, user.id));
          }

          done(null, {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
          });
        } catch (err) {
          done(err as Error);
        }
      }
    )
  );

  console.log('Google OAuth initialized');
}

// Initiate Google login
authRouter.get('/google', (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })(req, res, next);
});

// Google callback
authRouter.get(
  '/google/callback',
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('google', {
      session: false,
      failureRedirect: '/login?error=auth_failed',
    })(req, res, next);
  },
  (req: Request, res: Response) => {
    const user = req.user as OAuthUser;
    const token = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    // Redirect to frontend with token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
  }
);

// Get current user info
authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const authReq = req as AuthenticatedRequest;
    const user = await db.query.users.findFirst({
      where: eq(users.id, authReq.user!.userId),
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

// Logout (client handles token removal, this is just for any server-side cleanup)
authRouter.post('/logout', (_req: Request, res: Response) => {
  res.json({ success: true });
});

// Delete account
authRouter.delete('/account', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user!.userId;

    // 1. Delete Pinecone vectors for user
    if (isPineconeEnabled()) {
      try {
        await deleteUserNamespace(userId);
      } catch (error) {
        console.error('Failed to delete Pinecone namespace:', error);
      }
    }

    // 2. Delete files from disk
    try {
      await deleteUserFiles(userId);
    } catch (error) {
      console.error('Failed to delete user files:', error);
    }

    // 3. Delete user from database (cascade will handle collections and documents)
    await db.delete(users).where(eq(users.id, userId));

    res.json({ success: true, message: 'Account deleted' });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});
