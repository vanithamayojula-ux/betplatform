import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12505612",
  authToken: process.env.TOKEN,
  groqKey: process.env.GROQ_KEY,
  groqModel: "openai/gpt-oss-20b",
};

const headers = {
  "Content-Type": "application/json",
  Authorization: CONFIG.authToken,
};

async function pickBestOption(q) {
  const opts = [q.amcq?.option1, q.amcq?.option2, q.amcq?.option3, q.amcq?.option4];
  const exp = (q.explanation || "").toLowerCase();
  
  // 1. Exact / substring match
  for (let i = 0; i < opts.length; i++) {
    if (opts[i] && exp.includes(opts[i].toLowerCase())) {
      console.log(` -> Substring match: Option ${i + 1} ("${opts[i]}")`);
      return i + 1;
    }
  }

  // 2. Groq LLM match with explanation context
  const prompt = `Question: ${q.question}\nContext/Explanation: ${q.explanation || ""}\nOptions:\n1) ${opts[0]}\n2) ${opts[1]}\n3) ${opts[2]}\n4) ${opts[3]}\n\nWhich option number (1, 2, 3, or 4) is correct according to the context? Respond with ONLY the digit 1, 2, 3, or 4.`;
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${CONFIG.groqKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: CONFIG.groqModel,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 50,
      }),
    });
    const d = await res.json();
    const txt = d.choices?.[0]?.message?.content || d.choices?.[0]?.message?.reasoning || "";
    const m = txt.match(/[1-4]/);
    if (m) {
      const pick = Number(m[0]);
      console.log(` -> Groq match: Option ${pick} ("${opts[pick - 1]}") (raw: ${txt.slice(0, 50)})`);
      return pick;
    }
  } catch (e) {
    console.warn(`Groq error: ${e.message}`);
  }

  return 1;
}

async function test() {
  const examId = "673388000";
  const qUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/questions`;
  const qRes = await fetch(qUrl, { headers });
  const qData = await qRes.json();
  const questions = (qData.test_definition_section || []).flatMap(s => s.questions || []);

  for (const q of questions) {
    console.log(`\n--- Q ${q.id} : ${q.question} ---`);
    const pick = await pickBestOption(q);
    console.log(`Final Pick: ${pick}`);
  }
}

test().catch(console.error);
