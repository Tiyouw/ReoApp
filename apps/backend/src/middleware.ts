import { Request, Response, NextFunction } from 'express';
import { supabase } from './supabase';

/**
 * Unified auth middleware: accepts JWT (Authorization: Bearer) OR device-token.
 * Attaches req.userId (from JWT) and/or req.deviceToken to the request.
 * Backward compatible — endpoints still work with device-token only.
 */
export async function authenticateUser(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'] as string;
  const deviceToken = req.headers['x-device-token'] as string;

  // Try JWT first
  if (authHeader?.startsWith('Bearer ')) {
    const jwt = authHeader.slice(7);
    try {
      const { data: { user }, error } = await supabase.auth.getUser(jwt);
      if (user && !error) {
        (req as any).userId = user.id;
        (req as any).userEmail = user.email;
        // Also set device token if present (for dual-auth scenarios)
        if (deviceToken) (req as any).deviceToken = deviceToken;
        return next();
      }
    } catch {
      // JWT invalid — fall through to device token
    }
  }

  // Fall back to device token
  if (deviceToken) {
    (req as any).deviceToken = deviceToken;
    return next();
  }

  return res.status(401).json({ error: 'Authentication required: provide Authorization header or x-device-token' });
}

/**
 * Helper to get the query filter based on auth type.
 * Prefers user_id if available, falls back to device_token.
 */
export function getOwnerFilter(req: Request): { column: string; value: string } {
  const userId = (req as any).userId;
  const deviceToken = (req as any).deviceToken;
  if (userId) return { column: 'user_id', value: userId };
  if (deviceToken) return { column: 'device_token', value: deviceToken };
  throw new Error('No auth context');
}

/**
 * Legacy middleware — kept for backward compatibility.
 */
export function requireDeviceToken(req: Request, res: Response, next: NextFunction) {
  const token = req.headers['x-device-token'] as string;
  if (!token) {
    return res.status(400).json({ error: 'x-device-token header required' });
  }
  (req as any).deviceToken = token;
  next();
}
