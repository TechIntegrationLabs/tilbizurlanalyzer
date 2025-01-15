import express from 'express';
import cors from 'cors';
import { analyzeBusiness } from './business-analyzer.js';
import { saveAnalysis, getDatabase } from './db.js';
import { sheetsService } from './sheets.js';
import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

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
