import 'dotenv/config';
import { analyzeBusiness } from './business-analyzer.js';
import { saveAnalysis } from './db.js';
import { sheetsService } from './sheets.js';

async function runTest() {
  try {
    console.log('Starting Business Knowledge Base analysis...');
    const bkb = await analyzeBusiness({
      url: 'https://www.thedodorestaurant.com/',
      apiKey: process.env.ANTHROPIC_API_KEY,
      options: {
        checkSocial: true,
        checkTechnical: true,
        timeout: 90000  // Increased timeout for thorough analysis
      }
    });

    // Format and display the output
    console.log(JSON.stringify(bkb, null, 2));
    console.log('\n=== Analysis Complete ===\n');

    // Save to MongoDB
    console.log('Saving to MongoDB...');
    await saveAnalysis(bkb);
    console.log('Successfully saved to MongoDB');

    // Save to Google Sheets
    console.log('\nSaving to Google Sheets...');
    await sheetsService.appendAnalysis(bkb);
    console.log('Successfully saved to Google Sheets');

  } catch (error) {
    console.error('Error during analysis:', error);
  }
}

// Run the analysis
runTest();
