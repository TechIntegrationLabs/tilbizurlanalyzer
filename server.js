import express from 'express';
import cors from 'cors';
import { analyzeBusiness } from './business-analyzer.js';
import { saveAnalysis, getDatabase } from './db.js';
import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';
import { ObjectId } from 'mongodb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Middleware: Debugging
app.use((req, res, next) => {
  console.log(`[DEBUG] ${req.method} request to ${req.url}`);
  console.log(`[DEBUG] Headers:`, req.headers);
  next();
});

// Middleware: CORS
app.use(cors({
  origin: [
    'https://zp1v56uxy8rdx5ypatb0ockcb9tr6a-oci3--5173--1b4252dd.local-credentialless.webcontainer-api.io',
    'https://bizanal.evolvmybiz.com' // Add other origins here if necessary
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// Middleware: JSON Parsing
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// Function: Send data to Make.com webhook
async function sendToMake(data) {
  try {
    if (!process.env.MAKE_WEBHOOK_URL) {
      console.warn('MAKE_WEBHOOK_URL not set in environment variables');
      return;
    }

    const response = await fetch(process.env.MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Make.com webhook failed: ${response.statusText}`);
    }

    console.log('Data sent to Make.com successfully');
  } catch (error) {
    console.error('Error sending data to Make.com:', error);
  }
}

// POST /analyze: Submit a new analysis request
app.post('/analyze', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const db = await getDatabase();
    const initialAnalysis = {
      url,
      status: 'processing',
      startTime: new Date(),
      error: null
    };
    const result = await db.collection('business_analyses').insertOne(initialAnalysis);
    const analysisId = result.insertedId;

    // Asynchronous analysis process
    (async () => {
      try {
        console.log(`Starting analysis for URL: ${url}`);
        const analysis = await analyzeBusiness({
          url,
          apiKey: process.env.ANTHROPIC_API_KEY,
          options: {
            checkSocial: true,
            checkTechnical: true,
            timeout: 90000
          }
        });

        await db.collection('business_analyses').updateOne(
          { _id: analysisId },
          { $set: { ...analysis, status: 'completed', completedTime: new Date() } }
        );

        await sendToMake(analysis);
      } catch (error) {
        console.error('Analysis error:', error);
        await db.collection('business_analyses').updateOne(
          { _id: analysisId },
          { $set: { status: 'error', error: error.message, completedTime: new Date() } }
        );
      }
    })();

    res.json({ status: 'processing', analysisId: analysisId.toString() });
  } catch (error) {
    console.error('Request error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /status/:analysisId: Check analysis status
app.get('/status/:analysisId', async (req, res) => {
  try {
    const { analysisId } = req.params;
    if (!ObjectId.isValid(analysisId)) {
      return res.status(400).json({ error: 'Invalid analysis ID' });
    }

    const db = await getDatabase();
    const analysis = await db.collection('business_analyses').findOne({ _id: new ObjectId(analysisId) });
    if (!analysis) return res.status(404).json({ error: 'Analysis not found' });

    const response = {
      status: analysis.status,
      startTime: analysis.startTime,
      completedTime: analysis.completedTime
    };

    if (analysis.error) response.error = analysis.error;
    if (analysis.status === 'completed') response.data = analysis;

    res.json(response);
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
