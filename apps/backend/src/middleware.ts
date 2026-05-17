import { Request, Response, NextFunction } from 'express';

export function requireDeviceToken(req: Request, res: Response, next: NextFunction) {
  const token = req.headers['x-device-token'] as string;
  if (!token) {
    return res.status(400).json({ error: 'x-device-token header required' });
  }
  (req as any).deviceToken = token;
  next();
}
