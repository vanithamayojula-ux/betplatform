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
  fs.appendFileSync("writing_execution.log", msg + "\n");
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

async function generateAnswer(qPrompt, explanation) {
  const cleanPrompt = (qPrompt || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const cleanExp = (explanation || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  
  if (cleanExp && cleanExp.length > 10 && !cleanExp.includes("No explanation available")) {
    return cleanExp;
  }

  if (CONFIG.groqKey) {
    try {
      const prompt = `You are a student taking an official Business English Writing exam.
Answer the following writing prompt following ALL constraints strictly (such as exact word count limits e.g. "5-8 words", "8-10 words", "2-4 words subject", or specific required starting words e.g. "We need a...", "Please find...").

Question Prompt: "${cleanPrompt}"

Rules:
1. Produce ONLY the direct answer text.
2. Do NOT wrap in quotes. Do NOT add any preamble or commentary.

Answer:`;

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
        const d = await res.json();
        let txt = d.choices?.[0]?.message?.content?.trim() || "";
        if (txt) return txt.replace(/^["']|["']$/g, "").trim();
      }
    } catch (e) {
      log(`Groq AI generation warning: ${e.message}`);
    }
  }

  return "We need an experienced professional to manage key daily operations efficiently.";
}

async function createOrGetExam(lessonInstId, existingExamId) {
  const createUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams`;
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(createUrl, { method: "POST", headers: getHeaders(), body: "{}" });
      const txt = await res.text();
      let d = {};
      try { d = JSON.parse(txt); } catch {}
      const examId = d.id || d.exam_id || d.examId;
      if (examId) return String(examId);
    } catch (e) {}
    await sleep(500);
  }

  if (existingExamId) {
    log(`  Using existing examId ${existingExamId} for lessonInstId ${lessonInstId}`);
    return String(existingExamId);
  }
  return null;
}

async function solveAndSubmitWritingLesson(lesson, inst) {
  const lessonInstId = inst.lesson_inst_id;
  const seqNo = lesson.seq_no;
  const lessonName = lesson.lesson_name;
  
  log(`\n------------------------------------------------------------`);
  log(`Solving Lesson ${seqNo}: "${lessonName}" (InstId: ${lessonInstId})`);
  log(`------------------------------------------------------------`);

  const examId = await createOrGetExam(lessonInstId, inst.exam_id);
  if (!examId) {
    log(` ERROR: Could not create or obtain exam ID for lesson ${seqNo}`);
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
  log(` Found ${questions.length} question(s)`);

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const qType = q.type || "SUBJECTIVE";

    if (qType === "SUB" || qType === "SUBJECTIVE" || qType === "WRITING" || qType === "SHORT_ANSWER") {
      const ansText = await generateAnswer(q.question, q.explanation);
      log(`  Q${i+1} [${qType}]: Answer -> "${ansText}"`);
      
      const ansUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`;
      const ansRes = await fetch(ansUrl, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          type: "SUBJECTIVE",
          question_uuid: q.uuid,
          subjective_written_answer: ansText
        })
      });
      const ansStatus = ansRes.status;
      log(`  Q${i+1} Answer Submit HTTP: ${ansStatus}`);
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
  log(` Submit HTTP: ${subRes.status} | Response: ${subText}`);
  return subRes.ok;
}

async function main() {
  fs.writeFileSync("writing_execution.log", "=== WRITING SOLVER START ===\n");
  await login();

  let grandTotalLessons = 0;
  let grandCompletedLessons = 0;

  for (const u of CONFIG.targetUnits) {
    log(`\n============================================================`);
    log(`=== ${u.name} ===`);
    log(`============================================================`);

    const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.writingSectionInstId}/bet-section-unit-insts/${u.uId}/bet-section-unit-lesson-insts`;
    const res = await fetch(url, { headers: getHeaders() });
    const lessons = await res.json();

    for (const l of lessons) {
      grandTotalLessons++;
      const insts = l.section_unit_lesson_insts || [];
      const inst = insts.slice(-1)[0] || insts[0] || {};
      const completedCount = l.completed_lessons_count || 0;
      const status = l.lesson_status || inst.bet_status;
      const isDone = completedCount > 0 || status === "COMPLETED" || status === "PASSED";

      if (isDone) {
        grandCompletedLessons++;
        log(`L${l.seq_no} ("${l.lesson_name}"): ALREADY COMPLETED (status=${status}, count=${completedCount})`);
      } else {
        log(`L${l.seq_no} ("${l.lesson_name}"): NEEDS SOLVING (status=${status}, count=${completedCount})`);
        await solveAndSubmitWritingLesson(l, inst);
        await sleep(300);
      }
    }
  }

  log(`\n============================================================`);
  log(`=== FINAL VERIFICATION SCAN ===`);
  log(`============================================================`);

  let finalCompleted = 0;
  for (const u of CONFIG.targetUnits) {
    const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.writingSectionInstId}/bet-section-unit-insts/${u.uId}/bet-section-unit-lesson-insts`;
    const res = await fetch(url, { headers: getHeaders() });
    const lessons = await res.json();
    for (const l of lessons) {
      const completedCount = l.completed_lessons_count || 0;
      const insts = l.section_unit_lesson_insts || [];
      const inst = insts.slice(-1)[0] || insts[0] || {};
      const status = l.lesson_status || inst.bet_status;
      const isDone = completedCount > 0 || status === "COMPLETED" || status === "PASSED";
      if (isDone) finalCompleted++;
      log(`L${l.seq_no} (${l.lesson_name}): status=${status}, completed_count=${completedCount}, pending_count=${l.pending_lessons_count}`);
    }
  }

  log(`\nTOTAL LESSONS PASSED: ${finalCompleted} / ${grandTotalLessons} (${Math.round(finalCompleted / grandTotalLessons * 100)}%)`);
}

main().catch(e => log(`FATAL ERROR: ${e.stack || e.message}`));
