import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = 'http://localhost:3000';

async function testAnalyzer() {
  try {
    console.log('Testing business analyzer...');
    console.log('Using API key:', process.env.ANTHROPIC_API_KEY ? 'Yes' : 'No');
    
    // Test analyze endpoint with a real business website
    console.log('\n1. Testing /api/analyze endpoint...');
    const analyzeResponse = await axios.post(`${BASE_URL}/api/analyze`, {
      url: 'https://www.apple.com',
      timestamp: Date.now()
    });
    
    console.log('Analyze Response:', {
      status: analyzeResponse.status,
      data: analyzeResponse.data
    });

    if (analyzeResponse.data.analysisId) {
      // Test status endpoint
      console.log('\n2. Testing /api/status endpoint...');
      const statusResponse = await axios.get(`${BASE_URL}/api/status/${analyzeResponse.data.analysisId}`);
      console.log('Status Response:', {
        status: statusResponse.status,
        data: statusResponse.data
      });

      // Poll status for up to 3 minutes
      console.log('\n3. Polling status endpoint (up to 3 minutes)...');
      let attempts = 0;
      const maxAttempts = 36; // 36 * 5 seconds = 3 minutes
      let lastStatus = null;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        const pollResponse = await axios.get(`${BASE_URL}/api/status/${analyzeResponse.data.analysisId}`);
        
        // Only log if status changed
        if (attempts === 0 || pollResponse.data.status !== lastStatus) {
          console.log(`\nPoll ${attempts + 1}:`, {
            status: pollResponse.status,
            data: pollResponse.data
          });
        } else {
          process.stdout.write('.'); // Show progress without cluttering console
        }

        // Store last status
        lastStatus = pollResponse.data.status;

        // Stop if analysis is complete or failed
        if (pollResponse.data.status === 'completed' || pollResponse.data.status === 'error') {
          console.log('\n\nAnalysis complete! Final result:', JSON.stringify(pollResponse.data, null, 2));
          break;
        }

        attempts++;
      }
    }

  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  }
}

testAnalyzer();
