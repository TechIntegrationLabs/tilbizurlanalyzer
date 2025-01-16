import express from 'express';
import cors from 'cors';
import { analyzeBusiness } from './business-analyzer.js';
import { saveAnalysis, getDatabase } from './db.js';
import { sheetsService } from './sheets.js';
import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// Function to send data to Make.com webhook
async function sendToMake(data) {
  try {
    if (!process.env.MAKE_WEBHOOK_URL) {
      console.warn('MAKE_WEBHOOK_URL not set in environment variables');
      return;
    }

    const response = await fetch(process.env.MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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

// API endpoint to analyze a URL
app.post('/api/analyze', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Start analysis
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

    // Save to MongoDB
    await saveAnalysis(analysis);

    // Save to Google Sheets
    await sheetsService.appendAnalysis(analysis);

    // Send to Make.com webhook
    await sendToMake(analysis);

    // Return results
    res.json({
      status: 'success',
      data: analysis
    });

  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Get all analyses from MongoDB
app.get('/api/analyses', async (req, res) => {
  try {
    const db = await getDatabase();
    const analyses = await db.collection('business_analyses')
      .find({})
      .sort({ 'metadata.analysis_date': -1 })
      .limit(100)
      .toArray();
    
    res.json({
      status: 'success',
      data: analyses
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Start server
app.listen(port, async () => {
  console.log(`Server running on port ${port}`);
  try {
    await sheetsService.initializeSheet();
    console.log('Google Sheets initialized');
  } catch (error) {
    console.error('Failed to initialize Google Sheets:', error);
  }
});
