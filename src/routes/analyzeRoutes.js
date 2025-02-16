import express from 'express';
import { startAnalysis, getAnalysisStatus, receiveAnalysis } from '../controllers/analyzeController.js';

const router = express.Router();

router.post('/analyze', startAnalysis);
router.get('/status/:id', getAnalysisStatus);
router.post('/receive-analysis', receiveAnalysis);

export default router;