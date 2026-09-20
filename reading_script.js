import "dotenv/config";
// Automate bet-exams completion for READING (DEV ONLY) — PBQ (passage -> Groq picks per MCQ)
// Reading: PBQ (1 Q with 5x MCQ) vs Listening AMCQ / Speaking SPCH
const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12505798",
  userEmail: "12505798@lpu.in",
  betExamIds: [], // e.g. ["649313300"] or [] for autoDiscover
  authToken: process.env.TOKEN,
  cookie: "",
  autoDiscover: true,
  betSectionInstId: "177437",
  betSectionUnitInstId: "941844", // 02 Following Return Policy Instructions (Reading)
  maxAutoLessons: 15,
  groqKey: process.env.GROQ_KEY,
  groqModel: "openai/gpt-oss-20b",
  delayMs: 800,
  scoreWaitMs: 1000,
};
const headers = { "Content-Type": "application/json" };
if (CONFIG.authToken) headers["Authorization"] = CONFIG.authToken;
if (CONFIG.cookie) headers["Cookie"] = CONFIG.cookie;
if (CONFIG.baseUrl.includes("localhost"))
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchQuestions(examId) {
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/questions`;
  console.log(`[GET] ${url}`);
  const res = await fetch(url, { headers, method: "GET" });
  if (!res.ok)
    throw new Error(`GET questions failed ${res.status} ${await res.text()}`);
  const data = await res.json();
  const questions = (data.test_definition_section || []).flatMap(
    (s) => s.questions || [],
  );
  console.log(
    ` -> Found ${questions.length} questions for exam ${examId} (${data.test_name})`,
  );
  return { meta: data, questions };
}

async function groqPickPBQ(passage, pbq) {
  if (!CONFIG.groqKey) throw new Error("GROQ_KEY missing");
  const opts = `1) ${pbq.mcq.option1} 2) ${pbq.mcq.option2} 3) ${pbq.mcq.option3} 4) ${pbq.mcq.option4}`;
  const system =
    "You are a reading comprehension assistant. Given passage and a multiple choice question with 4 options, pick the correct option number 1-4. Reply with only a single digit 1,2,3 or 4.";
  const user = `Passage: "${passage.replace(/<[^>]*>/g, " ").trim()}"\nQuestion: ${pbq.question}\nOptions: ${opts}`;
  const body = {
    model: CONFIG.groqModel,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.2,
    max_tokens: 50,
    reasoning_effort: "low",
  };
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CONFIG.groqKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok)
    throw new Error(`Groq pick failed ${res.status} ${await res.text()}`);
  const data = await res.json();
  let txt =
    data.choices?.[0]?.message?.content?.trim() ||
    data.choices?.[0]?.message?.reasoning?.trim() ||
    "";
  if (!txt || !/[1-4]/.test(txt)) {
    const r = data.choices?.[0]?.message?.reasoning || txt || "";
    const m2 = r.match(/[1-4]/);
    if (m2) txt = m2[0];
  }
  const m = txt.match(/[1-4]/);
  if (!m)
    throw new Error(
      `Groq pick empty ${txt} ${JSON.stringify(data).slice(0, 300)}`,
    );
  const pick = Number(m[0]);
  console.log(` -> Groq pick: ${pick} for "${pbq.question.slice(0, 40)}"`);
  return pick;
}

async function processExam(examId) {
  const { questions } = await fetchQuestions(examId);
  for (const q of questions) {
    console.log(`\n--- Q ${q.id} uuid=${q.uuid} type=${q.type} ---`);
    if (q.type !== "PBQ") {
      console.log(`Skipping ${q.type}`);
      continue;
    }
    const passage = q.question;
    // PBQ has 5x MCQ pbq_selected_answer
    const answers = [];
    for (const pbq of q.pbq || []) {
      let pick;
      // use content API answer if available for 100%, else Groq
      // For analytics we want Groq gpt-oss-20b
      try {
        pick = await groqPickPBQ(passage, pbq);
      } catch (e) {
        console.warn(` -> Groq failed, fallback to 2: ${e.message}`);
        pick = 2;
      }
      answers.push({
        type: "MCQ",
        mcq: { selected_answer: pick, question_uuid: pbq.uuid },
      });
      console.log(
        `  PBQ ${pbq.id} ${pbq.question.slice(0, 40)} -> pick ${pick}`,
      );
      await sleep(400);
    }
    // POST answers for PBQ: need to handle incremental pbq submission like your capture?
    // BET expects incremental: send each pbq_selected_answer separately or together?
    // Your manual did: POST {pbq_selected_answer: {answers:[{mcq:{selected_answer:2, question_uuid:d673...}}]}} per pbq batch
    // We'll send all together as one POST for the PBQ uuid
    const payload = {
      type: "PBQ",
      question_uuid: q.uuid,
      pbq_selected_answer: { answers },
    };
    console.log(
      `[POST] ${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers PBQ ${q.uuid} with ${answers.length} picks`,
    );
    const res = await fetch(
      `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`,
      { method: "POST", headers, body: JSON.stringify(payload) },
    );
    if (!res.ok)
      throw new Error(`PBQ submit failed ${res.status} ${await res.text()}`);
    const data = await res.json().catch(() => ({}));
    console.log(
      ` -> PBQ submitted: is_correct=${data.is_correct} marks_scored=${data.marks_scored}`,
    );
    await sleep(CONFIG.delayMs);
  }
  console.log(`\n=== Exam ${examId} done ===`);
}

async function submitExam(examId, lessonInstId) {
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams/${examId}:submit`;
  console.log(`[POST] ${url} :submit`);
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
  const txt = await res.text();
  console.log(` -> Status ${res.status} Body: ${txt.slice(0, 600)}`);
  if (!res.ok) throw new Error(`Submit failed ${res.status} ${txt}`);
  try {
    const d = JSON.parse(txt);
    console.log(
      ` -> Finalized: betStatus=${d.betStatus} percentage=${d.percentage}`,
    );
  } catch {}
  return txt;
}
async function getLessonInsts() {
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.betSectionInstId}/bet-section-unit-insts/${CONFIG.betSectionUnitInstId}/bet-section-unit-lesson-insts`;
  console.log(`[GET] ${url}`);
  const res = await fetch(url, { headers, method: "GET" });
  if (!res.ok)
    throw new Error(
      `GET lesson-insts failed ${res.status} ${await res.text()}`,
    );
  return res.json();
}
async function createExamForLesson(lessonInstId) {
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams`;
  console.log(`[POST] ${url} (create exam)`);
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
  const txt = await res.text();
  console.log(` -> Status ${res.status} Body: ${txt.slice(0, 600)}`);
  if (!res.ok) throw new Error(`Create exam failed ${res.status} ${txt}`);
  const d = JSON.parse(txt);
  const examId = d.id || d.exam_id || d.examId;
  if (!examId) throw new Error(`No exam id ${txt}`);
  console.log(
    ` -> Created exam_id=${examId} for lesson_inst_id=${lessonInstId}`,
  );
  return String(examId);
}
async function verifyExam(examId) {
  console.log(`\n[VERIFY] Checking analytics for exam ${examId}`);
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.betSectionInstId}/bet-section-unit-insts/${CONFIG.betSectionUnitInstId}/bet-section-unit-lesson-insts`;
  console.log(`[GET] ${url}`);
  const res = await fetch(url, { headers, method: "GET" });
  const txt = await res.text();
  console.log(` -> Status ${res.status}`);
  if (res.ok) {
    try {
      const d = JSON.parse(txt);
      console.log(` -> Found ${Array.isArray(d) ? d.length : 1} lessons`);
    } catch {
      console.log(txt.slice(0, 600));
    }
  }
}
async function runSingleLesson(examId, lessonInstId) {
  await processExam(examId);
  console.log(` -> Waiting ${CONFIG.scoreWaitMs}ms...`);
  await sleep(CONFIG.scoreWaitMs);
  await submitExam(examId, lessonInstId);
  for (let i = 0; i < 6; i++) {
    await sleep(3000);
    const lessons = await getLessonInsts();
    const cur = lessons.find(
      (l) =>
        (l.section_unit_lesson_insts || [])[0]?.lesson_inst_id ===
        Number(lessonInstId),
    );
    const pct = cur?.section_unit_lesson_insts?.[0]?.percentage;
    console.log(` -> Poll ${i + 1}: ${cur?.lesson_name} pct=${pct}`);
    if (pct !== null && pct !== undefined) break;
  }
  await verifyExam(examId);
}
async function main() {
  console.log(
    `Base: ${CONFIG.baseUrl}, Org: ${CONFIG.orgSlug}, User: ${CONFIG.userId}`,
  );
  if (!CONFIG.authToken || CONFIG.authToken.includes("PASTE_YOUR_TOKEN"))
    console.warn("WARN: Set TOKEN");
  if (CONFIG.betExamIds.length > 0) {
    console.log("Starting manual mode for exams:", CONFIG.betExamIds);
    const lessonMap = { 649313300: "7028950" }; // 02 Return Policy 9201697 -> 7028950
    for (const id of CONFIG.betExamIds) {
      try {
        const lid = lessonMap[id] || null;
        await processExam(id);
        if (lid) await submitExam(id, lid);
        else console.warn(`No lessonMap for ${id}`);
        await verifyExam(id);
      } catch (e) {
        console.error(`!! Failed exam ${id}:`, e.message);
      }
      await sleep(CONFIG.delayMs);
    }
    console.log("\nAll done. Check dashboard now.");
    return;
  }
  if (!CONFIG.autoDiscover) {
    console.log("No betExamIds and autoDiscover false");
    return;
  }
  console.log(`Starting AUTO mode (max ${CONFIG.maxAutoLessons} lessons)`);
  for (let i = 0; i < CONFIG.maxAutoLessons; i++) {
    const lessons = await getLessonInsts();
    let target = null;
    for (const l of lessons) {
      const inst = (l.section_unit_lesson_insts || [])[0];
      if (!inst) continue;
      const isNext =
        (l.lesson_status === "NOT_STARTED" ||
          l.lesson_status === "IN_PROGRESS") &&
        (inst.bet_status === "NOT_STARTED" ||
          inst.bet_status === "IN_PROGRESS") &&
        !inst.exam_id;
      if (isNext) {
        target = { lesson: l, inst };
        break;
      }
    }
    if (!target) {
      console.log("No IN_PROGRESS lesson");
      lessons.forEach((l) => {
        const inst = (l.section_unit_lesson_insts || [])[0];
        console.log(
          ` L${l.seq_no} ${l.lesson_name} status=${l.lesson_status} bet=${inst?.bet_status} id=${inst?.lesson_inst_id} exam=${inst?.exam_id}`,
        );
      });
      break;
    }
    const lessonInstId = String(target.inst.lesson_inst_id);
    console.log(
      `\n=== Auto L${target.lesson.seq_no} ${target.lesson.lesson_name} lesson_inst_id=${lessonInstId} ===`,
    );
    let examId = target.inst.exam_id ? String(target.inst.exam_id) : null;
    if (!examId) {
      examId = await createExamForLesson(lessonInstId);
      await sleep(CONFIG.delayMs);
    } else console.log(` -> Using existing exam_id=${examId}`);
    try {
      await runSingleLesson(examId, lessonInstId);
    } catch (e) {
      console.error(
        `!! Failed lesson ${lessonInstId} exam ${examId}:`,
        e.message,
      );
      break;
    }
    await sleep(CONFIG.delayMs);
  }
  console.log("\nAll done. Check dashboard now.");
}
main().catch(console.error);
