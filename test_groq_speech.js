import "dotenv/config";

const groqKey = process.env.GROQ_KEY || process.env.groq_key;
const groqModel = "llama-3.3-70b-versatile"; // or openai/gpt-oss-20b or llama-3.1-8b-instant

async function testGroq(prompt) {
  const cleanPrompt = prompt.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "openai/gpt-oss-20b"];

  for (const m of models) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: m,
          messages: [
            { role: "system", content: "You are answering a CEFR speaking test prompt. Provide a natural, direct 2-3 sentence spoken response in first person that answers all requirements. Do NOT use markdown, quotes, or preambles." },
            { role: "user", content: `Prompt: ${cleanPrompt}` }
          ],
          temperature: 0.1,
          max_tokens: 120
        })
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content?.trim();
        console.log(`[Model: ${m}] Result:\n${text}\n`);
        return text;
      } else {
        console.log(`Model ${m} failed status ${res.status}`);
      }
    } catch (e) {
      console.log(`Model ${m} error: ${e.message}`);
    }
  }
}

async function main() {
  console.log("=== Testing Q1 ===");
  await testGroq("Imagine you are at a company event and need to introduce your colleague to a new team. Share their name, job title, and one interesting fact about them in less than 1 minute.");

  console.log("=== Testing Q2 ===");
  await testGroq("You have just met a new team member. Use simple sentences to introduce yourself and ask one question about their role or background. You have 1 minute to complete this task.");
}

main().catch(console.error);
