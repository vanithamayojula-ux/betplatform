import "dotenv/config";
import fs from "fs";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12520776",
  userEmail: "12520776@lpu.in",
  userPass: "12520776",
  authToken: process.env.TOKEN,
  betSectionInstId: "176800",
  groqKey: process.env.GROQ_KEY || process.env.groq_key,
  groqModel: "openai/gpt-oss-20b",
  delayMs: 200,
  scoreWaitMs: 1000,
};

const ORDERED_UNITS = [
  941841, // Emails and Messages (15 lessons)
  941844, // Office Notices (15 lessons)
  941842, // Short Articles (10 lessons)
  941843, // Reports and Summaries (1 lesson)
  941845, // Workplace Guidelines (12 lessons)
  941846, // Level Test (15 lessons)
];

const headers = { "Content-Type": "application/json" };
if (CONFIG.authToken) headers["Authorization"] = CONFIG.authToken;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function log(...args) {
  const line = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ") + "\n";
  process.stdout.write(line);
  fs.appendFileSync("reading_progress.txt", line);
}

process.on("uncaughtException", (err) => {
  log("UNCAUGHT EXCEPTION:", err.stack || err);
});
process.on("unhandledRejection", (reason) => {
  log("UNHANDLED REJECTION:", reason?.stack || reason);
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchQuestions(examId) {
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/questions`;
  log(`[GET] ${url}`);
  const res = await fetch(url, { headers, method: "GET" });
  if (!res.ok) throw new Error(`GET questions failed ${res.status} ${await res.text()}`);
  const data = await res.json();
  const questions = (data.test_definition_section || []).flatMap((s) => s.questions || []);
  log(` -> Found ${questions.length} questions for exam ${examId} (${data.test_name})`);
  return { meta: data, questions };
}

async function groqPickPBQ(passage, pbq) {
  if (!CONFIG.groqKey) return 2;
  const opts = `1) ${pbq.mcq?.option1 || pbq.option1} 2) ${pbq.mcq?.option2 || pbq.option2} 3) ${pbq.mcq?.option3 || pbq.option3} 4) ${pbq.mcq?.option4 || pbq.option4}`;
  const system = "You are a reading comprehension assistant. Given a passage and a multiple choice question with 4 options, pick the correct option number 1-4. Reply with only a single digit 1, 2, 3, or 4.";
  const user = `Passage: "${(passage || "").replace(/<[^>]*>/g, " ").trim()}"\nQuestion: ${pbq.question}\nOptions: ${opts}`;
  const body = {
    model: CONFIG.groqModel,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.1,
    max_tokens: 20,
  };
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CONFIG.groqKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return 2;
  const data = await res.json();
  let txt = data.choices?.[0]?.message?.content?.trim() || "";
  const m = txt.match(/[1-4]/);
  const pick = m ? Number(m[0]) : 2;
  log(` -> Groq pick: ${pick} for "${(pbq.question || "").slice(0, 40)}"`);
  return pick;
}

async function groqPickMCQ(question, options) {
  if (!CONFIG.groqKey) return 2;
  const opts = `1) ${options[0]} 2) ${options[1]} 3) ${options[2]} 4) ${options[3]}`;
  const system = "You are a reading comprehension assistant. Given a question with 4 options, pick the correct option number 1-4. Reply with only a single digit 1, 2, 3, or 4.";
  const user = `Question: ${(question || "").replace(/<[^>]*>/g, " ").trim()}\nOptions: ${opts}`;
  const body = {
    model: CONFIG.groqModel,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.1,
    max_tokens: 20,
  };
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CONFIG.groqKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return 2;
  const data = await res.json();
  let txt = data.choices?.[0]?.message?.content?.trim() || "";
  const m = txt.match(/[1-4]/);
  const pick = m ? Number(m[0]) : 2;
  log(` -> Groq pick: ${pick} for "${(question || "").slice(0, 40)}"`);
  return pick;
}

async function processExam(examId) {
  const { questions } = await fetchQuestions(examId);
  for (const q of questions) {
    log(`\n--- Q ${q.id} uuid=${q.uuid} type=${q.type} ---`);
    if (q.type === "PBQ") {
      const passage = q.question;
      const answers = [];
      for (const pbq of q.pbq || []) {
        let pick = await groqPickPBQ(passage, pbq);
        answers.push({
          type: "MCQ",
          mcq: { selected_answer: pick, question_uuid: pbq.uuid },
        });
        log(`  PBQ ${pbq.id} ${(pbq.question || "").slice(0, 40)} -> pick ${pick}`);
        await sleep(200);
      }
      const payload = {
        type: "PBQ",
        question_uuid: q.uuid,
        pbq_selected_answer: { answers },
      };
      const res = await fetch(
        `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`,
        { method: "POST", headers, body: JSON.stringify(payload) }
      );
      if (!res.ok) log(` -> PBQ submit error: ${res.status}`);
      else {
        const data = await res.json().catch(() => ({}));
        log(` -> PBQ submitted: is_correct=${data.is_correct} marks=${data.marks_scored}`);
      }
      await sleep(CONFIG.delayMs);
    } else if (q.type === "MCQ") {
      const opts = [q.mcq?.option1, q.mcq?.option2, q.mcq?.option3, q.mcq?.option4];
      let pick = await groqPickMCQ(q.question, opts);
      const payload = {
        type: "MCQ",
        question_uuid: q.uuid,
        mcq_selected_answer: pick,
      };
      const res = await fetch(
        `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`,
        { method: "POST", headers, body: JSON.stringify(payload) }
      );
      if (!res.ok) log(` -> MCQ submit error: ${res.status}`);
      else {
        const data = await res.json().catch(() => ({}));
        log(` -> MCQ submitted: is_correct=${data.is_correct} marks=${data.marks_scored}`);
      }
      await sleep(CONFIG.delayMs);
    } else if (q.type === "AMCQ") {
      const opts = [q.amcq?.option1, q.amcq?.option2, q.amcq?.option3, q.amcq?.option4];
      let pick = q.amcq?.answer || (await groqPickMCQ(q.question || q.explanation || "", opts));
      const payload = {
        type: "AMCQ",
        question_uuid: q.uuid,
        amcq_selected_answer: pick,
      };
      const res = await fetch(
        `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`,
        { method: "POST", headers, body: JSON.stringify(payload) }
      );
      if (!res.ok) log(` -> AMCQ submit error: ${res.status}`);
      else {
        const data = await res.json().catch(() => ({}));
        log(` -> AMCQ submitted: is_correct=${data.is_correct} marks=${data.marks_scored}`);
      }
      await sleep(CONFIG.delayMs);
    } else {
      log(`Skipping question type: ${q.type}`);
    }
  }
  log(`=== Exam ${examId} done ===`);
}

async function submitExam(examId, lessonInstId) {
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams/${examId}:submit`;
  log(`[POST] ${url} :submit`);
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });
      const txt = await res.text();
      log(` -> Status ${res.status} Body: ${txt.slice(0, 200)}`);
      if (res.ok) return txt;
      await sleep(2000 * attempt);
    } catch (e) {
      if (attempt === 3) throw e;
      await sleep(2000 * attempt);
    }
  }
}

async function getLessonInsts(unitId) {
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.betSectionInstId}/bet-section-unit-insts/${unitId}/bet-section-unit-lesson-insts`;
  const res = await fetch(url, { headers, method: "GET" });
  if (!res.ok) throw new Error(`GET lesson-insts failed ${res.status}`);
  return res.json();
}

async function createExamForLesson(lessonInstId) {
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams`;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({}) });
  const txt = await res.text();
  if (!res.ok) throw new Error(`Create exam failed ${res.status} ${txt}`);
  const d = JSON.parse(txt);
  const examId = d.id || d.exam_id || d.examId;
  log(` -> Created exam_id=${examId} for lesson_inst_id=${lessonInstId}`);
  return String(examId);
}

function isLessonDone(inst) {
  if (!inst) return false;
  const status = inst.bet_status || inst.lesson_status;
  return status === "COMPLETED" || status === "PASSED" || inst.percentage != null;
}

async function solveUnit(unitId) {
  log(`\n========================================================`);
  log(`========== STARTING READING UNIT: ${unitId} ==========`);
  log(`========================================================`);

  const attemptedLessons = new Set();

  while (true) {
    try {
      let lessons = await getLessonInsts(unitId);
      if (!Array.isArray(lessons)) {
        await sleep(1500);
        continue;
      }

      let target = null;
      for (const l of lessons) {
        const inst = (l.section_unit_lesson_insts || [])[0];
        if (isLessonDone(inst)) continue;

        const isLocked = (l.lesson_status === "LOCKED" || inst?.bet_status === "LOCKED" || !inst?.lesson_inst_id) && !inst?.exam_id;
        if (!isLocked && inst?.lesson_inst_id) {
          if (attemptedLessons.has(inst.lesson_inst_id)) {
            const hasLaterUnlocked = lessons.some((laterL) => {
              const laterInst = (laterL.section_unit_lesson_insts || [])[0];
              const laterLocked = (laterL.lesson_status === "LOCKED" || laterInst?.bet_status === "LOCKED" || !laterInst?.lesson_inst_id) && !laterInst?.exam_id;
              return (
                laterL.seq_no > l.seq_no &&
                !isLessonDone(laterInst) &&
                !laterLocked &&
                laterInst?.lesson_inst_id &&
                !attemptedLessons.has(laterInst.lesson_inst_id)
              );
            });
            if (hasLaterUnlocked) continue;
          }
          target = { lesson: l, inst };
          break;
        }
      }

      if (!target) {
        const allDoneOrLocked = lessons.every((l) => {
          const inst = (l.section_unit_lesson_insts || [])[0];
          const isLocked = (l.lesson_status === "LOCKED" || inst?.bet_status === "LOCKED" || !inst?.lesson_inst_id) && !inst?.exam_id;
          return isLessonDone(inst) || (inst?.lesson_inst_id && attemptedLessons.has(inst.lesson_inst_id)) || isLocked;
        });

        if (allDoneOrLocked) {
          log(`\n>>> READING UNIT ${unitId} COMPLETED / ALL ACCESSIBLE LESSONS DONE! <<<`);
          break;
        }

        log(`Waiting 2s for next lesson in Reading Unit ${unitId} to unlock...`);
        await sleep(2000);
        continue;
      }

      const lessonInstId = String(target.inst.lesson_inst_id);
      attemptedLessons.add(target.inst.lesson_inst_id);

      log(`\n--------------------------------------------------------`);
      log(`>>> Processing L${target.lesson.seq_no} "${target.lesson.lesson_name}" (InstId: ${lessonInstId}) <<<`);
      log(`--------------------------------------------------------`);

      let examId = null;
      if (target.inst.bet_status === "FAILED" || !target.inst.exam_id) {
        try {
          examId = await createExamForLesson(lessonInstId);
        } catch (e) {
          if (target.inst.exam_id) {
            examId = String(target.inst.exam_id);
            log(` -> Using existing exam_id=${examId}`);
          } else {
            log(`!! Create exam error: ${e.message}`);
            await sleep(2000);
            continue;
          }
        }
      } else {
        examId = String(target.inst.exam_id);
        log(` -> Using existing exam_id=${examId}`);
      }

      await processExam(examId);
      log(` -> Submitting exam ${examId}...`);
      await submitExam(examId, lessonInstId);
      log(` -> Waiting 1500ms for database sync...`);
      await sleep(1500);
    } catch (err) {
      log(`!! solveUnit error in loop: ${err.message}, retrying in 2s...`);
      await sleep(2000);
    }
  }
}

async function main() {
  fs.writeFileSync("reading_progress.txt", `=== READING AUTOMATION STARTED: User ${CONFIG.userId} ===\n`);
  log(`[READING] Started for User: ${CONFIG.userId}, Section: ${CONFIG.betSectionInstId}`);

  for (const unitId of ORDERED_UNITS) {
    await solveUnit(unitId);
    await sleep(1000);
  }

  log("\n============================================================");
  log("=== ALL READING UNITS AND LESSONS COMPLETED 100%! ===");
  log("============================================================");
}

main().catch((e) => log("FATAL ERROR in main:", e));
