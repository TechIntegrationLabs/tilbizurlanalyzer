import express from 'express';
import { startAnalysis, getAnalysisStatus } from '../controllers/analyzeController.js';

const router = express.Router();

router.post('/analyze', startAnalysis);
router.get('/status/:id', getAnalysisStatus);

export default router;