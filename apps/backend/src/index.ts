import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

let reoState = {
  persona: 'jowo',
  task: ''
};

app.get('/api/reo/state', (req, res) => {
  res.json(reoState);
});

app.post('/api/reo/state', (req, res) => {
  const { persona, task } = req.body;
  if (persona) reoState.persona = persona;
  if (task !== undefined) reoState.task = task;
  res.json({ success: true, state: reoState });
});

app.post('/api/reo/chat', async (req, res) => {
  const { context } = req.body;
  
  let systemPrompt = "You are Reo, a productivity companion.";
  if (reoState.persona === 'jowo') systemPrompt += " You speak in funny, angry Javanese slang to scold the user for slacking.";
  if (reoState.persona === 'jaksel') systemPrompt += " You speak in South Jakarta slang (Indonesian-English mix), being very sassy.";
  if (reoState.persona === 'professional') systemPrompt += " You speak politely and professionally.";
  
  const prompt = `${systemPrompt}\n\nThe user is currently supposed to be working on this task: "${reoState.task}".\nHowever, Context: ${context}\nGive a short 1-2 sentence reprimand.`;
  
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    res.json({ message: text });
  } catch (error) {
    console.error("Gemini API Error:", error);
    // Fallback response if the API key is invalid or errors out
    res.json({ message: `[FALLBACK] Hadeh! Task "${reoState.task}" aja belum beres, malah mainan yang lain. Cepet balik kerja!` });
  }
});

const PORT = process.env.PORT || 3333;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
  });
}

export default app;
