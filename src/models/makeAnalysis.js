import mongoose from 'mongoose';

const makeAnalysisSchema = new mongoose.Schema({
  url: { type: String, required: true },
  result: mongoose.Schema.Types.Mixed, // Stores analysis result
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('MakeAnalysis', makeAnalysisSchema);
