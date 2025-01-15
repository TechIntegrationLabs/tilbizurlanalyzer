import 'dotenv/config';
import { analyzeBusiness } from './business-analyzer.js';

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

    // Format the output nicely
    console.log(JSON.stringify(bkb, null, 2));
    console.log('\n=== Analysis Complete ===\n');
  } catch (error) {
    console.error('Error during analysis:', error);
  }
}

// Run the analysis
runTest();
