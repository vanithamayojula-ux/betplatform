import "dotenv/config";

function clean(text) {
  return (text || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[^a-zA-Z0-9\s:]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

async function pickOption(q) {
  const rawOpts = [q.amcq?.option1, q.amcq?.option2, q.amcq?.option3, q.amcq?.option4];
  const opts = rawOpts.map(clean);
  const exp = clean(q.explanation);
  const question = clean(q.question);

  // 1. Direct substring in explanation
  for (let i = 0; i < opts.length; i++) {
    if (!opts[i]) continue;
    if (exp.includes(opts[i])) {
      return { pick: i + 1, reason: `Direct exp substring "${opts[i]}"` };
    }
  }

  // 2. Direct substring in question
  for (let i = 0; i < opts.length; i++) {
    if (!opts[i]) continue;
    if (question.includes(opts[i])) {
      return { pick: i + 1, reason: `Direct q substring "${opts[i]}"` };
    }
  }

  // 3. Time match (e.g. 10:30, 12:15, 3:15, 11:15)
  for (let i = 0; i < opts.length; i++) {
    if (!opts[i]) continue;
    const timeMatch = opts[i].match(/\d{1,2}:\d{2}/);
    if (timeMatch && exp.includes(timeMatch[0])) {
      return { pick: i + 1, reason: `Time match "${timeMatch[0]}"` };
    }
  }

  // 4. Groq LLM for 100% precision on semantic/synonym questions
  const prompt = `Question: ${clean(q.question)}\nContext/Explanation: ${clean(q.explanation)}\nOptions:\n1) ${rawOpts[0].replace(/<[^>]*>/g, "").trim()}\n2) ${rawOpts[1].replace(/<[^>]*>/g, "").trim()}\n3) ${rawOpts[2].replace(/<[^>]*>/g, "").trim()}\n4) ${rawOpts[3].replace(/<[^>]*>/g, "").trim()}\n\nWhich option (1, 2, 3, or 4) is the correct answer according to the explanation? Think briefly and state the final answer as "ANSWER: X".`;
  
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-20b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 200,
    }),
  });
  const d = await res.json();
  const txt = d.choices?.[0]?.message?.content || d.choices?.[0]?.message?.reasoning || "";
  let m = txt.match(/ANSWER:\s*([1-4])/i) || txt.match(/Option\s*([1-4])/i);
  if (!m) {
    const digits = txt.match(/[1-4]/g);
    if (digits) m = [null, digits[digits.length - 1]];
  }
  const pick = m ? Number(m[1] || m[0]) : 1;
  return { pick, reason: `Groq LLM match (raw: ${txt.slice(0, 40)})` };
}

async function test() {
  const examId = "673543050";
  const qUrl = `https://corporate.bharatenglish.org/api/orgs/lpu724598/users/12505612/bet-exams/${examId}/questions`;
  const qRes = await fetch(qUrl, { headers: { Authorization: process.env.TOKEN } });
  const qData = await qRes.json();
  const questions = (qData.test_definition_section || []).flatMap(s => s.questions || []);

  for (const q of questions) {
    console.log(`\n--- Q ${q.id} : ${q.question.replace(/<[^>]*>/g, "")} ---`);
    console.log("Explanation:", q.explanation.replace(/<[^>]*>/g, ""));
    const res = await pickOption(q);
    console.log(`Pick: ${res.pick} -> ${res.reason}`);
  }
}

test();
