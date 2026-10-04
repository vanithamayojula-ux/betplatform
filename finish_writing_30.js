import "dotenv/config";
import fs from "fs";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12520776",
  userEmail: "12520776@lpu.in",
  userPass: "12520776",
  authToken: process.env.TOKEN,
  betSectionInstId: "176869",
  groqKey: process.env.GROQ_KEY || process.env.groq_key,
  groqModel: "openai/gpt-oss-20b",
  delayMs: 200,
};

const TARGET_UNITS = [941805, 941820];
const headers = { "Content-Type": "application/json" };
if (CONFIG.authToken) headers["Authorization"] = CONFIG.authToken;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function groqGenerateWritingAnswer(questionHtml) {
  if (!CONFIG.groqKey) return "Please review the attached document at your earliest convenience.";
  const prompt = questionHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
  const body = {
    model: CONFIG.groqModel,
    messages: [
      { role: "system", content: "You are a fluent CEFR business English student answering writing questions. Provide a clear, polite, and grammatically correct answer in 1-3 sentences. Output ONLY your direct answer." },
      { role: "user", content: prompt }
    ],
    temperature: 0.1,
    max_tokens: 150,
  };
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${CONFIG.groqKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() || "Please review the details at your earliest convenience.";
    }
  } catch {}
  return "Please review the details at your earliest convenience.";
}

async function solveLesson(lessonInstId) {
  const urlQ = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams`;
  const resE = await fetch(urlQ, { method: "POST", headers, body: JSON.stringify({}) });
  const dE = await resE.json();
  const examId = dE.id || dE.exam_id;
  if (!examId) return;

  const resQ = await fetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/questions`, { headers });
  const dataQ = await resQ.json();
  const questions = (dataQ.test_definition_section || []).flatMap((s) => s.questions || []);

  for (const q of questions) {
    const ansText = await groqGenerateWritingAnswer(q.question);
    const payload = {
      type: "SUBJECTIVE_WRITTEN",
      question_uuid: q.uuid,
      subjective_written_answer: ansText,
    };
    await fetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    await sleep(CONFIG.delayMs);
  }

  const resSub = await fetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams/${examId}:submit`, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
  console.log(`Submitted Writing Exam ${examId} for Lesson ${lessonInstId}: ${resSub.status}`);
}

async function main() {
  for (const uId of TARGET_UNITS) {
    const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.betSectionInstId}/bet-section-unit-insts/${uId}/bet-section-unit-lesson-insts`;
    const res = await fetch(url, { headers });
    if (!res.ok) continue;
    const lessons = await res.json();
    for (const l of lessons) {
      const inst = (l.section_unit_lesson_insts || [])[0];
      const isDone = l.lesson_status === "COMPLETED" || inst?.bet_status === "COMPLETED" || inst?.bet_status === "PASSED" || inst?.bet_status === "PENDING_EVALUATION" || inst?.percentage != null;
      if (!isDone && inst?.lesson_inst_id) {
        console.log(`Solving Writing Unit ${uId} L${l.seq_no}...`);
        await solveLesson(String(inst.lesson_inst_id));
      }
    }
  }
}

main().catch(console.error);
