import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import apiRouter from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({
    service: 'EcoSearch API',
    version: '0.1.0',
    health: '/api/health',
  });
});

app.use('/api', apiRouter);

// Must stay last so unmatched routes and thrown errors are caught.
app.use(notFound);
app.use(errorHandler);

export default app;
