import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db.js';
import analyzeRoutes from './routes/analyzeRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

connectDB();

app.use(cors(
  {
    origin: '*',
  }
));
app.use(express.json());
app.use('/api', analyzeRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
