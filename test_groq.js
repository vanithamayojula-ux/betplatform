import fs from 'fs';
import 'dotenv/config';

const groqKey = process.env.GROQ_KEY || process.env.groq_key;

async function testGroq() {
  const body = JSON.stringify({
    model: "openai/gpt-oss-20b",
    messages: [
      { role: "system", content: "You are a professional business English writer. Output ONLY the answer text." },
      { role: "user", content: "Write a short job title for a marketing role." }
    ],
    temperature: 0.1,
    max_tokens: 100
  });

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${groqKey}`,
      "Content-Type": "application/json"
    },
    body
  });

  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

testGroq();
