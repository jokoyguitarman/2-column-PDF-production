import express from 'express';
import cors from 'cors';
import { generate2ColumnPdfRouter } from './routes/generate-2column-pdf';
import { generateWordDocxRouter } from './routes/generate-word-docx';
import { convertDocxToPdfRouter } from './routes/convert-docx-to-pdf';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'PDF Generation Microservice'
  });
});

// API Routes
app.use('/api/generate-2column-pdf', generate2ColumnPdfRouter);
app.use('/api/generate-word-docx', generateWordDocxRouter);
app.use('/api/convert-docx-to-pdf', convertDocxToPdfRouter);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`PDF Generation Microservice running on port ${PORT}`);
});

export default app;
