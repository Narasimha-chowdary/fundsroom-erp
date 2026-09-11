import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import apiV1Routes from './routes';
import { errorHandler } from './middlewares/error.middleware';

const app: Application = express();

// Middlewares
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'Fundsroom ERP API',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/v1', apiV1Routes);

// Centralized error handler
app.use(errorHandler);

export default app;
