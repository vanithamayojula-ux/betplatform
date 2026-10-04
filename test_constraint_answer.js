import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12517515",
  userEmail: "12517515@lpu.in",
  userPassCombo: [{ username: "12517515@lpu.in", password: "12517515" }],
  authToken: null,
  groqKey: process.env.GROQ_KEY || process.env.groq_key,
  groqModel: "openai/gpt-oss-20b"
};

const headers = { "Content-Type": "application/json" };
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function loginIfNeeded() {
  const url = `${CONFIG.baseUrl}/api/public/bet-exams/login`;
  for (const c of CONFIG.userPassCombo) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: c.username, password: c.password, appContext: "BET_CORPORATE" }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = await res.json();
        const rawToken = data.jwtToken || data.token || data.id_token;
        if (rawToken) {
          const token = rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`;
          CONFIG.authToken = token;
          headers["Authorization"] = token;
          return token;
        }
      }
    } catch (e) {}
  }
}

async function generateStrictAnswer(promptText) {
  const prompt = `You are a strict English test candidate answering a writing question.
Follow ALL constraints in the prompt EXACTLY (such as word count limits like 5-8 words, 8-10 words, 2-4 word subject, or specific starting words like 'We need a...').

Question Prompt: "${promptText}"

Output ONLY the final exact response string. Do not include quotes, explanations, or labels.`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${CONFIG.groqKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: CONFIG.groqModel,
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 150
      })
    });
    const d = await res.json();
    return d.choices?.[0]?.message?.content?.trim() || "";
  } catch (e) {
    return "The cleaner sweeps and mops the office.";
  }
}

async function testL2Constraint() {
  await loginIfNeeded();
  const lessonInstId = "7963390"; // Topic 1 L2
  const examUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams`;
  const examRes = await fetch(examUrl, { method: "POST", headers, body: "{}" });
  const examData = await examRes.json();
  const examId = String(examData.id || examData.exam_id);
  console.log("Created Exam ID:", examId);

  const qUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/questions`;
  const qRes = await fetch(qUrl, { headers });
  const qData = await qRes.json();
  const questions = (qData.test_definition_section || []).flatMap((s) => s.questions || []);

  for (const q of questions) {
    const promptText = (q.question || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const ansText = await generateStrictAnswer(promptText);
    const wordCount = ansText.split(/\s+/).length;
    console.log(`\nQ [${promptText}]`);
    console.log(`Generated Answer (${wordCount} words): "${ansText}"`);

    const ansUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`;
    const submitAnsRes = await fetch(ansUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ type: "SUBJECTIVE", question_uuid: q.uuid, subjective_written_answer: ansText })
    });
    console.log("Submit Ans Status:", submitAnsRes.status);
  }

  // Submit Exam
  const submitUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams/${examId}:submit`;
  const subRes = await fetch(submitUrl, { method: "POST", headers, body: "{}" });
  console.log("\nFinalized Exam Response:", await subRes.text());
}

testL2Constraint().catch(console.error);
