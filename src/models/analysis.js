import mongoose from 'mongoose';

const analysisSchema = new mongoose.Schema({
  url: { type: String, required: true },
  status: { type: String, default: 'processing' },
  startTime: { type: Date, default: Date.now },
  completedTime: Date,
  error: String,
  result: mongoose.Schema.Types.Mixed, // Stores analysis result
});

export default mongoose.model('Analysis', analysisSchema);