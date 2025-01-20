import Analysis from '../models/analysis.js';
import { analyzeBusiness } from '../services/businessAnalyzer.js';
import { sendToMake } from '../utils/sendToMake.js';

export const startAnalysis = async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  let newAnalysis;
  try {
    // Create a new analysis record with initial status
    newAnalysis = await Analysis.create({ url, status: 'processing', startTime: new Date() });
    res.status(202).json({ status: 'processing', analysisId: newAnalysis._id });

    // Perform analysis asynchronously
    await performAnalysis(newAnalysis);
  } catch (error) {
    console.error('Error starting analysis:', error);
    if (newAnalysis) {
      newAnalysis.status = 'error';
      newAnalysis.error = error.message;
      await newAnalysis.save();
    }
    res.status(500).json({ error: 'Failed to start analysis' });
  }
};

const performAnalysis = async (analysis) => {
  try {
    console.log('Starting analysis:', analysis._id, analysis.url, process.env.ANTHROPIC_API_KEY);

    // Call the business analyzer service
    const result = await analyzeBusiness({
      url: analysis.url,
      apiKey: process.env.ANTHROPIC_API_KEY,
      options: {
        checkSocial: true,
        checkTechnical: true,
        timeout: 90000,
      },
    });

    // Update the analysis record with the result
    analysis.status = 'completed';
    analysis.completedTime = new Date();
    analysis.result = result;
    await analysis.save();

    // Notify via external service
    await sendToMake(result);
  } catch (error) {
    // Handle errors during the analysis process
    analysis.status = 'error';
    analysis.error = error.message;
    analysis.completedTime = new Date();
    await analysis.save();
    console.error('Error analyzing business:', error);
  }
};

export const getAnalysisStatus = async (req, res) => {
  const { id } = req.params;
  try {
    // Fetch analysis by ID
    const analysis = await Analysis.findById(id);
    if (!analysis) return res.status(404).json({ error: 'Analysis not found' });

    // Respond with analysis details
    res.json({
      status: analysis.status,
      startTime: analysis.startTime,
      completedTime: analysis.completedTime,
      result: analysis.result,
      error: analysis.error,
    });
  } catch (error) {
    console.error('Error fetching analysis:', error);
    res.status(500).json({ error: 'Failed to fetch analysis' });
  }
};
