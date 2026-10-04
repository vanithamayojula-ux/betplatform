import "dotenv/config";

async function test() {
  const models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "openai/gpt-oss-20b"];
  for (const m of models) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GROQ_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: m,
          messages: [{ role: "user", content: "Tell me in 2 sentences about spending a day without technology." }],
        }),
      });
      const data = await res.json();
      console.log(`Model ${m}: status=${res.status}`, data.choices?.[0]?.message?.content || data.error);
    } catch (e) {
      console.error(`Model ${m} error:`, e.message);
    }
  }
}

test();
