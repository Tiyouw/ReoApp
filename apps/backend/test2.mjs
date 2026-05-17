import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI("AIzaSyALHl-4V4kZHqCuRDY3NUA6F-F03xkp7uI");
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

model.generateContent("Hello")
  .then(res => console.log(res.response.text()))
  .catch(err => console.error("FULL ERROR:", err));
