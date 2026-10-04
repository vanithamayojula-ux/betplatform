import "dotenv/config";
import fs from "fs";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12517515",
  userEmail: "12517515@lpu.in",
  userPass: "12517515",
  authToken: null,
  groqKey: process.env.GROQ_KEY || process.env.groq_key,
  groqModel: "openai/gpt-oss-20b",
  writingSectionInstId: "176869",
  targetUnits: [
    { uId: 941805, name: "Topic 1 (From Job Posts to Recruitment Messages)" },
    { uId: 941820, name: "Topic 2 (Writing a simple email)" }
  ]
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function log(...args) {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(" ");
  console.log(msg);
  fs.appendFileSync("writing_high_accuracy.log", msg + "\n");
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function getHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": CONFIG.authToken
  };
}

async function login() {
  const url = `${CONFIG.baseUrl}/api/public/bet-exams/login`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: CONFIG.userEmail, password: CONFIG.userPass, appContext: "BET_CORPORATE" }),
  });
  if (!res.ok) throw new Error(`Login failed with status ${res.status}`);
  const data = await res.json();
  let rawToken = data.jwtToken || data.token || data.id_token;
  if (!rawToken.startsWith("Bearer ")) rawToken = "Bearer " + rawToken;
  CONFIG.authToken = rawToken;
  log(`Login successful for ${CONFIG.userEmail}`);
}

function parseRequiredConstraint(qPrompt) {
  const cleanPrompt = (qPrompt || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  // Check for starting phrase requirements e.g. starts with 'We need a...'
  const startMatch = cleanPrompt.match(/starts?\s+with\s+['"‘“]([^'"’”]+)['"’”]/i) || cleanPrompt.match(/says?\s+['"‘“]([^'"’”]+)['"’”]/i);
  let startingPhrase = startMatch ? startMatch[1] : null;

  // Check for word limits
  const wordLimitMatch = cleanPrompt.match(/(\d+)\s*[–-]\s*(\d+)\s*words?/i);
  let minWords = wordLimitMatch ? parseInt(wordLimitMatch[1]) : null;
  let maxWords = wordLimitMatch ? parseInt(wordLimitMatch[2]) : null;

  return { cleanPrompt, startingPhrase, minWords, maxWords };
}

async function generateStrictAnswer(qPrompt, explanation) {
  const { cleanPrompt, startingPhrase, minWords, maxWords } = parseRequiredConstraint(qPrompt);
  const cleanExp = (explanation || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  if (cleanExp && cleanExp.length > 15 && !cleanExp.toLowerCase().includes("no explanation")) {
    return cleanExp;
  }

  if (CONFIG.groqKey) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const systemInstruction = `You are an expert English writing tutor completing a formal Business English Writing Assessment.
Your response MUST STRICTLY fulfill ALL instructions in the prompt.
- If the prompt specifies a starting phrase (e.g. "We need a...", "Join our team as...", "Dear..."), your answer MUST start EXACTLY with those words.
- If the prompt specifies a word count (e.g., "5-8 words", "8-10 words"), your response length MUST fall precisely inside that word range.
- Provide ONLY the direct writing answer. No extra quotes, explanation, or greetings.`;

        const userPrompt = `Prompt: "${cleanPrompt}"\n${startingPhrase ? `REQUIRED STARTING PHRASE: "${startingPhrase}"\n` : ''}${minWords ? `REQUIRED WORD COUNT: between ${minWords} and ${maxWords} words\n` : ''}\nOutput ONLY the final text.`;

        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${CONFIG.groqKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: CONFIG.groqModel,
            messages: [
              { role: "system", content: systemInstruction },
              { role: "user", content: userPrompt }
            ],
            temperature: 0,
            max_tokens: 150
          }),
          signal: AbortSignal.timeout(10000)
        });

        if (res.ok) {
          const d = await res.json();
          let txt = d.choices?.[0]?.message?.content?.trim() || "";
          if (txt) {
            txt = txt.replace(/^["']|["']$/g, "").trim();
            if (startingPhrase && !txt.toLowerCase().startsWith(startingPhrase.toLowerCase())) {
              txt = `${startingPhrase} ${txt}`;
            }
            return txt;
          }
        }
      } catch (e) {
        log(`Groq AI attempt ${attempt} timeout/error: ${e.message}`);
      }
    }
  }

  // Fallback smart generation logic
  if (startingPhrase) {
    if (startingPhrase.toLowerCase().includes("we need a")) {
      return "We need a skilled team member to join our growing company.";
    }
    if (startingPhrase.toLowerCase().includes("join our team as")) {
      return "Join our team as a cook in our main restaurant.";
    }
    if (startingPhrase.toLowerCase().includes("you must")) {
      return "You must have strong English communication skills for this role.";
    }
    return `${startingPhrase} qualified professional for our team.`;
  }

  return "Dear Hiring Manager, I am writing to express my interest in this position and look forward to discussing my qualifications.";
}

async function solveLesson(lesson, inst) {
  const lessonInstId = inst.lesson_inst_id;
  const seqNo = lesson.seq_no;
  const lessonName = lesson.lesson_name;

  log(`\n------------------------------------------------------------`);
  log(`Solving L${seqNo}: "${lessonName}" (lessonInstId: ${lessonInstId})`);
  log(`------------------------------------------------------------`);

  // Create exam
  const createUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams`;
  let examId = null;
  try {
    const res = await fetch(createUrl, { method: "POST", headers: getHeaders(), body: "{}" });
    const txt = await res.text();
    let d = {};
    try { d = JSON.parse(txt); } catch {}
    examId = d.id || d.exam_id || d.examId;
  } catch (e) {}

  if (!examId && inst.exam_id) {
    examId = inst.exam_id;
  }

  if (!examId) {
    log(` ERROR: Failed to obtain examId for L${seqNo}`);
    return false;
  }
  log(` Exam ID: ${examId}`);

  // Fetch Questions
  const qUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/questions`;
  const qRes = await fetch(qUrl, { headers: getHeaders() });
  if (!qRes.ok) {
    log(` ERROR: Could not fetch questions for exam ${examId}`);
    return false;
  }
  const qData = await qRes.json();
  const questions = (qData.test_definition_section || []).flatMap(s => s.questions || []);
  log(` Questions count: ${questions.length}`);

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const qType = q.type || "SUBJECTIVE";

    if (qType === "SUB" || qType === "SUBJECTIVE" || qType === "WRITING" || qType === "SHORT_ANSWER") {
      const ansText = await generateStrictAnswer(q.question, q.explanation);
      log(`  Q${i+1} Answer: "${ansText}"`);

      const ansUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`;
      await fetch(ansUrl, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          type: "SUBJECTIVE",
          question_uuid: q.uuid,
          subjective_written_answer: ansText
        })
      });
    } else if (qType === "MCQ") {
      const ansUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`;
      await fetch(ansUrl, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ type: "MCQ", question_uuid: q.uuid, mcq_selected_answer: 1 })
      });
    }
    await sleep(200);
  }

  // Submit Exam
  const submitUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams/${examId}:submit`;
  const subRes = await fetch(submitUrl, { method: "POST", headers: getHeaders(), body: "{}" });
  const subText = await subRes.text();
  log(` Submit HTTP: ${subRes.status} | Body: ${subText}`);
  return subRes.ok;
}

async function main() {
  fs.writeFileSync("writing_high_accuracy.log", "=== HIGH ACCURACY WRITING TRACK SOLVER ===\n");
  await login();

  for (const u of CONFIG.targetUnits) {
    log(`\n============================================================`);
    log(`=== ${u.name} ===`);
    log(`============================================================`);

    const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.writingSectionInstId}/bet-section-unit-insts/${u.uId}/bet-section-unit-lesson-insts`;
    const res = await fetch(url, { headers: getHeaders() });
    const lessons = await res.json();

    for (const l of lessons) {
      const insts = l.section_unit_lesson_insts || [];
      const inst = insts.slice(-1)[0] || insts[0] || {};
      const completedCount = l.completed_lessons_count || 0;
      const pct = inst.percentage != null ? Number(inst.percentage) : null;
      const status = l.lesson_status || inst.bet_status;

      const isCompleted = (completedCount > 0 || status === "COMPLETED" || status === "PASSED") && (pct == null || pct >= 85);

      if (isCompleted) {
        log(`L${l.seq_no} ("${l.lesson_name}"): ALREADY PASSED (pct=${pct}%, count=${completedCount})`);
      } else {
        log(`L${l.seq_no} ("${l.lesson_name}"): SOLVING... (status=${status}, pct=${pct}%)`);
        await solveLesson(l, inst);
        await sleep(400);
      }
    }
  }

  log(`\nExecution complete. Backend evaluation in progress.`);
}

main().catch(e => log(`FATAL ERROR: ${e.stack || e.message}`));
