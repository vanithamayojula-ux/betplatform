import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "1250xxxx",  // Use your registration id
  userEmail: "1250xxxx@lpu.in",  // Use your registration id
  betExamIds: [],
  authToken: process.env.TOKEN,
  cookie: "",
  autoDiscover: true,
  betSectionInstId: "177434",
  betSectionUnitInstId: "941823",
  maxAutoLessons: 15,
  groqKey: process.env.GROQ_KEY,
  sarvamKey: process.env.SARVAM_KEY,
  groqModel: "openai/gpt-oss-20b",
  groqWhisperModel: "whisper-large-v3-turbo",
  delayMs: 800,
  scoreWaitMs: 2000,
};

import fs from "fs";
import path from "path";
import os from "os";
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

async function groqWhisperTranscribe(audioUrl) {
  if (!CONFIG.groqKey) throw new Error("GROQ_KEY missing");
  console.log(` -> Fetching audio for Whisper: ${audioUrl}`);
  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) throw new Error(`fetch audio failed ${audioRes.status}`);
  const ab = await audioRes.arrayBuffer();
  const tmp = path.join(os.tmpdir(), `whisper-${Date.now()}.mp3`);
  await fs.promises.writeFile(tmp, Buffer.from(ab));
  const form = new FormData();
  const blob = new Blob([Buffer.from(ab)], { type: "audio/mpeg" });
  form.append("file", blob, "audio.mp3");
  form.append("model", CONFIG.groqWhisperModel);
  form.append("response_format", "json");
  form.append("temperature", "0");
  const res = await fetch(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${CONFIG.groqKey}` },
      body: form,
    },
  );
  if (!res.ok)
    throw new Error(`Whisper failed ${res.status} ${await res.text()}`);
  const data = await res.json();
  const text = data.text?.trim();
  console.log(` -> Whisper transcript: "${(text || "").slice(0, 120)}"`);
  if (!text) throw new Error("Whisper empty");
  return text;
}

async function groqPickAMCQ(question, transcript, options) {
  if (!CONFIG.groqKey) throw new Error("GROQ_KEY missing");
  const opts = `1) ${options[0]} 2) ${options[1]} 3) ${options[2]} 4) ${options[3]}`;
  const system =
    "You are a listening test assistant. Given transcript and question with 4 options, pick the correct option number 1-4. Reply with only a single digit 1,2,3 or 4.";
  const user = `Question: ${question}\nTranscript: "${transcript}"\nOptions: ${opts}`;
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
    const reasoning = data.choices?.[0]?.message?.reasoning || txt || "";
    const alt = reasoning.match(/[1-4]/);
    if (alt) txt = alt[0];
  }
  const m = txt.match(/[1-4]/);
  if (!m)
    throw new Error(
      `Groq pick empty ${txt} ${JSON.stringify(data).slice(0, 300)}`,
    );
  const pick = Number(m[0]);
  console.log(` -> Groq pick: ${pick} for "${question.slice(0, 40)}"`);
  return pick;
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

  console.log(`[POST] ${url} uuid=${q.uuid} pick=${pick}`);
  let res;
  for (let a = 0; a < 3; a++) {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (res.ok) break;
    const t = await res.text();
    console.warn(
      ` -> Attempt ${a + 1} failed ${res.status} ${t.slice(0, 200)}`,
    );
    if (a < 2) await sleep(1200);
    else throw new Error(`Submit failed ${res.status} ${t}`);
  }
  const data = await res.json().catch(() => ({}));
  console.log(
    ` -> Answer submitted: ${JSON.stringify(data).slice(0, 200)} is_correct=${data.is_correct}`,
  );
  return data;
}

async function processExam(examId) {
  const { questions } = await fetchQuestions(examId);
  for (const q of questions) {
    console.log(`\n--- Q ${q.id} uuid=${q.uuid} type=${q.type} ---`);
    console.log(`Q text: ${q.question.slice(0, 120)}`);
    if (q.type !== "AMCQ" && q.type !== "MCQ") {
      console.log(`Skipping ${q.type}`);
      continue;
    }
    const audioUrl =
      q.amcq?.audio_path || q.amcq?.ind_audio_link || q.audio_path;
    const opts = [
      q.amcq?.option1,
      q.amcq?.option2,
      q.amcq?.option3,
      q.amcq?.option4,
    ];
    let pick;

    if (audioUrl) {
      try {
        const transcript = await groqWhisperTranscribe(audioUrl);
        pick = await groqPickAMCQ(q.question, transcript, opts);
      } catch (e) {
        console.warn(
          ` -> Whisper/Groq failed, fallback to answer ${q.amcq?.answer}: ${e.message}`,
        );
        pick = q.amcq?.answer || 2;
      }
    } else pick = q.amcq?.answer || 2;
    await submitAnswer(examId, q, pick);
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
    console.warn("WARN: Set TOKEN env var");
  if (CONFIG.betExamIds.length > 0) {
    console.log("Starting manual mode for exams:", CONFIG.betExamIds);

    const lessonMap = { 648836400: "5539753", 648897900: "7653304" };
    for (const id of CONFIG.betExamIds) {
      try {
        const lid = lessonMap[id] || null;
        await processExam(id);
        if (lid) await submitExam(id, lid);
        else console.warn(`No lessonMap for ${id}, skipping :submit`);
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
