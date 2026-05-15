import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

app.post('/api/reo/chat', async (req, res) => {
  const { persona, context } = req.body;
  
  let systemPrompt = "You are Reo, a productivity companion.";
  if (persona === 'jowo') systemPrompt += " You speak in funny, angry Javanese slang to scold the user for slacking.";
  if (persona === 'jaksel') systemPrompt += " You speak in South Jakarta slang (Indonesian-English mix), being very sassy.";
  
  const prompt = `${systemPrompt}\n\nContext: ${context}\nGive a short 1-2 sentence reprimand.`;
  
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    res.json({ message: text });
  } catch (error) {
    res.status(500).json({ error: 'AI Error' });
  }
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
  });
}

export default app;
