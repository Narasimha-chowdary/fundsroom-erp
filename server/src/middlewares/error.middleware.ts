import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';

export const errorHandler: ErrorRequestHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Handle Zod Schema Validation Errors
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    res.status(400).json({
      success: false,
      error: {
        statusCode: 400,
        message: 'Validation failed',
        details,
      },
    });
    return;
  }

  // Handle Known Custom Operational Errors (AppError, UnauthorizedError, etc.)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        statusCode: err.statusCode,
        message: err.message,
      },
    });
    return;
  }

  // Log unknown unexpected exceptions
  console.error('[Unhandled Error]:', err);

  const statusCode = typeof err.statusCode === 'number' ? err.statusCode : 500;
  const message = statusCode === 500 ? 'Internal server error' : err.message || 'An error occurred';

  res.status(statusCode).json({
    success: false,
    error: {
      statusCode,
      message,
    },
  });
};
