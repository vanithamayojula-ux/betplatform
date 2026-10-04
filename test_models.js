import fs from 'fs';
import 'dotenv/config';

const groqKey = process.env.GROQ_KEY || process.env.groq_key;

async function listModels() {
  const res = await fetch("https://api.groq.com/openai/v1/models", {
    headers: { Authorization: `Bearer ${groqKey}` }
  });
  const data = await res.json();
  console.log(data.data.map(m => m.id));
}

listModels();
