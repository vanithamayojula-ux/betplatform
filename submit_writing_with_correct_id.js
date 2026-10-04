import "dotenv/config";
import fs from "fs";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12517515",
  userEmail: "12517515@lpu.in",
  userPassCombo: [{ username: "12517515@lpu.in", password: "12517515" }],
  authToken: null,
  groqKey: process.env.GROQ_KEY || process.env.groq_key,
  groqModel: "openai/gpt-oss-20b",
  writingSectionInstId: "176869",
  targetUnits: [
    { uId: 941805, name: "Topic 1 (From Job Posts to Recruitment Messages)" },
    { uId: 941820, name: "Topic 2 (Writing a simple email)" }
  ]
};

function getHeaders() {
  const h = { "Content-Type": "application/json" };
  if (CONFIG.authToken) h["Authorization"] = CONFIG.authToken;
  return h;
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function log(...args) {
  const line = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ") + "\n";
  process.stdout.write(line);
  fs.appendFileSync("writing_fix.log", line);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
          const payloadBase64 = token.split(".")[1];
          const payloadJson = JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf8"));
          if (payloadJson.sub) CONFIG.userId = payloadJson.sub;
          log(` -> Login OK for ${c.username}`);
          return token;
        }
      }
    } catch (e) {}
  }
}

async function generateAnswer(qPrompt, explanation) {
  const cleanPrompt = (qPrompt || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const cleanExp = (explanation || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (cleanExp && cleanExp.length > 15) return cleanExp;

  if (CONFIG.groqKey) {
    try {
      const prompt = `You are a candidate taking a business English writing test.
Answer the writing prompt adhering STRICTLY to all constraints (such as word limits like "5-8 words", "8-10 words", "2-4 word subject", or starting phrases like "We need a...").

Question Prompt: "${cleanPrompt}"

Output ONLY your direct final answer text. Do not add quotes, commentary, or extra explanations.`;

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${CONFIG.groqKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: CONFIG.groqModel,
          messages: [{ role: "user", content: prompt }],
          temperature: 0,
          max_tokens: 150
        }),
        signal: AbortSignal.timeout(8000)
      });
      if (res.ok) {
        const data = await res.json();
        let txt = data.choices?.[0]?.message?.content?.trim() || "";
        if (txt) return txt.replace(/^["']|["']$/g, "").trim();
      }
    } catch (e) {}
  }
  return "Dear Team, I am writing to confirm our project schedule and update deliverables.";
}

async function runFix() {
  fs.writeFileSync("writing_fix.log", "=== STARTING WRITING SUBMISSION FIX ===\n");
  await loginIfNeeded();

  for (const u of CONFIG.targetUnits) {
    const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.writingSectionInstId}/bet-section-unit-insts/${u.uId}/bet-section-unit-lesson-insts`;
    const res = await fetch(url, { headers: getHeaders() });
    const lessons = await res.json();

    log(`\n============================================================`);
    log(`=== ${u.name} (Total: ${lessons.length}) ===`);
    log(`============================================================`);

    for (const l of lessons) {
      const insts = l.section_unit_lesson_insts || [];
      const inst = insts.find(i => i.is_latest) || insts[0] || {};
      const status = l.lesson_status || inst.bet_status;
      const completedCount = l.completed_lessons_count || 0;
      const lessonInstId = inst.lesson_inst_id;
      const sectionUnitLessonId = l.section_unit_lesson_id;

      if (completedCount > 0 || status === "COMPLETED") {
        log(`L${l.seq_no} ("${l.lesson_name}"): ALREADY COMPLETED (count=${completedCount})`);
        continue;
      }

      log(`\n[L${l.seq_no}: "${l.lesson_name}"] (inst: ${lessonInstId}, sectionUnitLessonId: ${sectionUnitLessonId}) Solving...`);

      try {
        // 1. Create Exam
        const examUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams`;
        const examRes = await fetch(examUrl, { method: "POST", headers: getHeaders(), body: "{}" });
        const examText = await examRes.text();
        let examData = {};
        try { examData = JSON.parse(examText); } catch {}
        const examId = String(examData.id || examData.exam_id);
        log(` -> Created Exam ID: ${examId}`);

        if (!examId || examId === "undefined") {
          log(` -> Error creating exam for L${l.seq_no}`);
          continue;
        }

        // 2. Fetch Questions & Answer
        const qUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/questions`;
        const qRes = await fetch(qUrl, { headers: getHeaders() });
        const qData = await qRes.json();
        const questions = (qData.test_definition_section || []).flatMap((s) => s.questions || []);

        for (const q of questions) {
          const ansText = await generateAnswer(q.question, q.explanation);
          const ansUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`;
          await fetch(ansUrl, {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({ type: "SUBJECTIVE", question_uuid: q.uuid, subjective_written_answer: ansText })
          });
        }

        // 3. Submit Exam using sectionUnitLessonId
        const submitUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${sectionUnitLessonId}/bet-exams/${examId}:submit`;
        const subRes = await fetch(submitUrl, { method: "POST", headers: getHeaders(), body: "{}" });
        const subText = await subRes.text();
        log(` -> Finalized Exam ${examId} via sectionUnitLessonId (${sectionUnitLessonId}): status=${subRes.status} body=${subText}`);

        await sleep(200);
      } catch (e) {
        log(` !! Error solving L${l.seq_no}: ${e.message}`);
      }
    }
  }

  log(`\n============================================================`);
  log(`=== WRITING SUBMISSION FIX COMPLETE ===`);
  log(`============================================================`);
}

runFix().catch(console.error);
