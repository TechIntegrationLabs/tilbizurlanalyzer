import { MongoClient } from 'mongodb';
import 'dotenv/config';

const uri = process.env.MONGODB_URI || 'mongodb+srv://techintegrationlabs:Verify1@bizanalysisresults.nwm4z.mongodb.net/';
const client = new MongoClient(uri);

let db;

async function connectToDatabase() {
  try {
    await client.connect();
    db = client.db('business_analysis');
    console.log('Connected to MongoDB');
    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

async function getDatabase() {
  if (!db) {
    db = await connectToDatabase();
  }
  return db;
}

async function saveAnalysis(analysis) {
  try {
    const db = await getDatabase();
    const collection = db.collection('business_analyses');
    const result = await collection.insertOne(analysis);
    console.log('Analysis saved to MongoDB:', result.insertedId);
    return result;
  } catch (error) {
    console.error('Error saving to MongoDB:', error);
    throw error;
  }
}

export { connectToDatabase, getDatabase, saveAnalysis };
