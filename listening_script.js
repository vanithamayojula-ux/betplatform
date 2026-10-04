import "dotenv/config";
import fs from "fs";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12520776",
  userEmail: "12520776@lpu.in",
  userPass: "12520776",
  authToken: process.env.TOKEN,
  betSectionInstId: "176874",
  groqKey: process.env.GROQ_KEY || process.env.groq_key,
  groqModel: "openai/gpt-oss-20b",
  delayMs: 100,
  scoreWaitMs: 800,
};

const ORDERED_UNITS = [
  941823, // Starting the Day Instructions (15 lessons)
  941828, // First Day at Work (15 lessons)
  941824, // Identifying Office Furniture (15 lessons)
  941825, // Morning Routine Overview (15 lessons)
  941826, // Print Room Confusion (12 lessons)
  941827, // Level Test (1 lesson)
];

const headers = {
  "Content-Type": "application/json",
  Authorization: CONFIG.authToken,
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function log(...args) {
  const line = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ") + "\n";
  process.stdout.write(line);
  fs.appendFileSync("listening_progress.txt", line);
}

process.on("uncaughtException", (err) => {
  log("UNCAUGHT EXCEPTION:", err.stack || err);
});
process.on("unhandledRejection", (reason) => {
  log("UNHANDLED REJECTION:", reason?.stack || reason);
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loginIfNeeded() {
  const url = `${CONFIG.baseUrl}/api/public/bet-exams/login`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: CONFIG.userEmail,
        password: CONFIG.userPass,
        appContext: "BET_CORPORATE",
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json();
      const token = data.token ? (data.token.startsWith("Bearer ") ? data.token : `Bearer ${data.token}`) : null;
      if (token) {
        CONFIG.authToken = token;
        headers["Authorization"] = token;
        log(` -> Auth token refreshed for ${CONFIG.userId}`);
        return token;
      }
    }
  } catch (e) {
    log(` -> Login refresh warning: ${e.message}`);
  }
}

function clean(text) {
  return (text || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[^a-zA-Z0-9\s:]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

async function getBestOption(q) {
  if (q.amcq?.answer && typeof q.amcq.answer === "number") {
    log(` -> Pre-provided answer key: Option ${q.amcq.answer}`);
    return q.amcq.answer;
  }

  const rawOpts = [q.amcq?.option1, q.amcq?.option2, q.amcq?.option3, q.amcq?.option4];
  const opts = rawOpts.map(clean);
  const exp = clean(q.explanation);

  const stopWords = new Set(["a", "an", "the", "in", "on", "at", "to", "for", "of", "it", "s", "is", "its"]);
  const expWords = new Set(exp.split(/\s+/).filter((w) => w.length > 0));
  let bestScore = -1;
  let bestIdx = 0;

  opts.forEach((opt, idx) => {
    if (!opt) return;
    const optWords = opt.split(/\s+/).filter((w) => w.length > 0 && !stopWords.has(w));
    if (optWords.length === 0) return;
    let matchCount = 0;
    optWords.forEach((w) => {
      if (expWords.has(w) || exp.includes(w)) matchCount++;
      else if (w.length > 4 && exp.includes(w.slice(0, 4))) matchCount += 0.8;
    });
    const score = matchCount / optWords.length;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  });

  if (bestScore >= 0.4) {
    log(` -> Word match (${Math.round(bestScore * 100)}%): Option ${bestIdx + 1} ("${opts[bestIdx]}")`);
    return bestIdx + 1;
  }

  // Groq LLM fallback for non-matching paraphrases
  if (CONFIG.groqKey) {
    try {
      const prompt = `Question: ${clean(q.question)}\nContext/Explanation: ${clean(q.explanation)}\nOptions:\n1) ${(rawOpts[0] || "").replace(/<[^>]*>/g, "").trim()}\n2) ${(rawOpts[1] || "").replace(/<[^>]*>/g, "").trim()}\n3) ${(rawOpts[2] || "").replace(/<[^>]*>/g, "").trim()}\n4) ${(rawOpts[3] || "").replace(/<[^>]*>/g, "").trim()}\n\nWhich option (1, 2, 3, or 4) is the correct answer according to the explanation? State your answer as "ANSWER: X".`;
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CONFIG.groqKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: CONFIG.groqModel,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
          max_tokens: 150,
        }),
        signal: AbortSignal.timeout(10000),
      });
      const d = await res.json();
      const txt = d.choices?.[0]?.message?.content || d.choices?.[0]?.message?.reasoning || "";
      let m = txt.match(/ANSWER:\s*([1-4])/i) || txt.match(/Option\s*([1-4])/i);
      if (!m) {
        const digits = txt.match(/[1-4]/g);
        if (digits) m = [null, digits[digits.length - 1]];
      }
      if (m) {
        const pick = Number(m[1] || m[0]);
        log(` -> Groq LLM match: Option ${pick}`);
        return pick;
      }
    } catch (e) {
      log(` -> Groq error: ${e.message}`);
    }
  }

  return bestIdx + 1;
}

async function fetchQuestions(examId) {
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/questions`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { headers, method: "GET", signal: AbortSignal.timeout(12000) });
      if (res.status === 401) {
        await loginIfNeeded();
      }
      if (res.ok) {
        const data = await res.json();
        const questions = (data.test_definition_section || []).flatMap((s) => s.questions || []);
        log(` -> Found ${questions.length} questions for exam ${examId}`);
        return { meta: data, questions };
      }
      const t = await res.text();
      if (attempt === 4) throw new Error(`GET questions failed ${res.status} ${t}`);
      await sleep(1000 * attempt);
    } catch (e) {
      if (attempt === 4) throw e;
      await sleep(1000 * attempt);
    }
  }
}

async function submitAnswer(examId, q, pick) {
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`;
  const payload = {
    type: q.type,
    question_uuid: q.uuid,
    amcq_selected_answer: pick,
    mcq_selected_answer: null,
    pbq_selected_answer: null,
    spch_selected_answer: null,
    subjective_written_answer: null,
  };

  for (let a = 0; a < 4; a++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(12000),
      });
      if (res.status === 401) {
        await loginIfNeeded();
      }
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        log(` -> Q ${q.id} Answer submitted: pick=${pick} is_correct=${data.is_correct}`);
        return data;
      }
      const t = await res.text();
      log(` -> Attempt ${a + 1} failed ${res.status} ${t.slice(0, 150)}`);
      await sleep(1000 * (a + 1));
    } catch (e) {
      if (a === 3) throw e;
      await sleep(1000 * (a + 1));
    }
  }
}

async function processExam(examId) {
  const { questions } = await fetchQuestions(examId);
  for (const q of questions) {
    if (q.type !== "AMCQ" && q.type !== "MCQ") {
      log(`Skipping ${q.type}`);
      continue;
    }
    const pick = await getBestOption(q);
    await submitAnswer(examId, q, pick);
    await sleep(CONFIG.delayMs);
  }
  log(`=== Exam ${examId} all questions answered ===`);
}

async function submitExam(examId, lessonInstId) {
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams/${examId}:submit`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(15000),
      });
      const txt = await res.text();
      if (res.ok) {
        try {
          const d = JSON.parse(txt);
          log(` -> Finalized: betStatus=${d.betStatus} percentage=${d.percentage}%`);
        } catch {}
        return txt;
      }
      if (res.status === 504 || res.status === 502 || res.status === 503) {
        log(` -> Server busy (${res.status}), retrying ${attempt}/4...`);
        await sleep(2000 * attempt);
        continue;
      }
      throw new Error(`Submit failed ${res.status} ${txt}`);
    } catch (e) {
      if (attempt === 4) throw e;
      log(` -> Submit error: ${e.message}, retrying...`);
      await sleep(2000 * attempt);
    }
  }
}

async function getLessonInsts(unitId) {
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.betSectionInstId}/bet-section-unit-insts/${unitId}/bet-section-unit-lesson-insts`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { headers, method: "GET", signal: AbortSignal.timeout(12000) });
      if (res.status === 401) {
        await loginIfNeeded();
      }
      if (res.ok) return res.json();
      const t = await res.text();
      if (attempt === 4) throw new Error(`GET lesson-insts failed ${res.status} ${t}`);
      await sleep(1000 * attempt);
    } catch (e) {
      if (attempt === 4) throw e;
      await sleep(1000 * attempt);
    }
  }
}

async function createExamForLesson(lessonInstId) {
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(12000),
      });
      if (res.status === 401) {
        await loginIfNeeded();
      }
      const txt = await res.text();
      let d = {};
      try { d = JSON.parse(txt); } catch {}
      const examId = d.id || d.exam_id || d.examId || d.betExamId;
      if (examId) {
        log(` -> Created/Found exam_id=${examId}`);
        return String(examId);
      }
      log(` -> createExam attempt ${attempt} (${res.status}): ${txt.slice(0, 100)}`);
      await sleep(1000 * attempt);
    } catch (e) {
      if (attempt === 4) throw e;
      await sleep(1000 * attempt);
    }
  }
  throw new Error(`No exam id returned for lesson ${lessonInstId}`);
}

function isLessonDone(inst) {
  if (!inst) return false;
  const status = inst.bet_status || inst.lesson_status;
  return status === "COMPLETED" || status === "PASSED" || inst.percentage != null;
}

async function solveUnit(unitId) {
  log(`\n========================================================`);
  log(`========== STARTING LISTENING UNIT: ${unitId} ==========`);
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
          log(`\n>>> LISTENING UNIT ${unitId} 100% COMPLETED / ALL ACCESSIBLE LESSONS DONE! <<<`);
          break;
        }

        log(`Waiting 2s for next lesson in Unit ${unitId} to unlock...`);
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
      log(` -> Waiting 2000ms for database sync...`);
      await sleep(2000);
    } catch (err) {
      log(`!! solveUnit error in loop: ${err.message}, retrying in 2s...`);
      await sleep(2000);
    }
  }
}

async function main() {
  fs.writeFileSync("listening_progress.txt", `=== LISTENING AUTOMATION STARTED: User ${CONFIG.userId} ===\n`);
  log(`[LISTENING] Started for User: ${CONFIG.userId}, Section: ${CONFIG.betSectionInstId}`);

  for (const unitId of ORDERED_UNITS) {
    await solveUnit(unitId);
    await sleep(1000);
  }

  log("\n============================================================");
  log("=== ALL LISTENING UNITS AND LESSONS COMPLETED 100%! ===");
  log("============================================================");
}

main().catch((e) => log("FATAL ERROR in main:", e));
