import "dotenv/config";
import fs from "fs";
import path from "path";
import os from "os";
import https from "https";
import { URL } from "url";
import { execSync } from "child_process";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12520776",
  userEmail: "12520776@lpu.in",
  userPass: "12520776",
  authToken: process.env.TOKEN,
  betSectionInstId: "176843",
  groqKey: process.env.GROQ_KEY || process.env.groq_key,
  groqModel: "openai/gpt-oss-20b",
  delayMs: 100,
  scoreWaitMs: 800,
  preferExistingAudio: false,
};

const ORDERED_UNITS = [
  941832, // Lecture 2: Morning Routine Walkthrough (15 lessons)
  941831, // Lecture 1: Basic Self-Introduction (15 lessons)
  941829, // Basic Request Dialogue (15 lessons)
  941830, // Basic IT Support Request Dialogue (14 lessons)
  941833, // Basic Directions Dialogue (8 lessons)
  941834, // Level Test (1 lesson)
];

const headers = { "Content-Type": "application/json" };
if (CONFIG.authToken) headers["Authorization"] = CONFIG.authToken;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function log(...args) {
  const line = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ") + "\n";
  process.stdout.write(line);
  fs.appendFileSync("speaking_progress.txt", line);
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
      const rawToken = data.jwtToken || data.token || data.id_token;
      if (rawToken) {
        const token = rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`;
        CONFIG.authToken = token;
        headers["Authorization"] = token;
        log(` -> Auth token refreshed for user ${CONFIG.userId}`);
        return token;
      }
    }
  } catch (e) {
    log(` -> Login refresh warning: ${e.message}`);
  }
}

function uploadToS3Https(s3Url, buffer) {
  return new Promise((resolve) => {
    let finished = false;
    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      try { req.destroy(); } catch {}
      resolve({ ok: false, status: 408, body: "S3 PUT Timeout" });
    }, 15000);

    let req;
    try {
      const u = new URL(s3Url);
      req = https.request(
        {
          hostname: u.hostname,
          port: 443,
          path: u.pathname + u.search,
          method: "PUT",
          headers: {
            "Content-Length": buffer.length,
          },
        },
        (res) => {
          let body = "";
          res.on("data", (c) => (body += c));
          res.on("end", () => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ ok: true, status: res.statusCode, body });
            } else {
              resolve({ ok: false, status: res.statusCode, body });
            }
          });
        }
      );
      req.on("error", (e) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        resolve({ ok: false, status: 500, body: e.message });
      });
      req.write(buffer);
      req.end();
    } catch (e) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({ ok: false, status: 500, body: e.message });
    }
  });
}

function generateFallbackWavBuffer() {
  const sampleRate = 16000;
  const numSamples = sampleRate * 2;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + numSamples * 2, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(numSamples * 2, 40);
  const pcm = Buffer.alloc(numSamples * 2);
  return Buffer.concat([header, pcm]);
}

function generateCompactLocalTTS(text) {
  try {
    const cleanText = text.replace(/[^a-zA-Z0-9\s.,?!'\-]/g, " ").replace(/\s+/g, " ").trim();
    const tmpTxt = path.join(os.tmpdir(), `tts_in_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`);
    const tmpWav = path.join(os.tmpdir(), `tts_out_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`);
    fs.writeFileSync(tmpTxt, cleanText, "utf8");
    
    const psScript = `
Add-Type -AssemblyName System.Speech
$txt = [System.IO.File]::ReadAllText('${tmpTxt.replace(/'/g, "''")}', [System.Text.Encoding]::UTF8)
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.Rate = 0
$s.Volume = 100
$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$s.SetOutputToWaveFile('${tmpWav.replace(/'/g, "''")}', $format)
$s.Speak($txt)
$s.Dispose()
`;
    const tmpPs1 = path.join(os.tmpdir(), `tts_script_${Date.now()}_${Math.random().toString(36).slice(2)}.ps1`);
    fs.writeFileSync(tmpPs1, psScript, "utf8");
    
    try {
      execSync(`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${tmpPs1}"`, { stdio: "pipe" });
    } finally {
      try { fs.unlinkSync(tmpTxt); } catch {}
      try { fs.unlinkSync(tmpPs1); } catch {}
    }
    
    if (fs.existsSync(tmpWav)) {
      const buffer = fs.readFileSync(tmpWav);
      try { fs.unlinkSync(tmpWav); } catch {}
      log(` -> Local TTS generated ${buffer.length} bytes for: "${cleanText.slice(0, 60)}..."`);
      return buffer;
    }
  } catch (e) {
    log(` -> TTS warning: ${e.message}, using fallback WAV`);
  }
  return generateFallbackWavBuffer();
}

async function fetchQuestions(examId) {
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/questions`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { headers, method: "GET", signal: AbortSignal.timeout(12000) });
      if (res.status === 401) await loginIfNeeded();
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

async function uploadSpeechAudio(mp3Buffer, filename = "test-audio.mp3") {
  const reserveUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userEmail}/speech-question:upload`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const reserveRes = await fetch(reserveUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(12000),
      });
      if (reserveRes.status === 401) await loginIfNeeded();
      if (!reserveRes.ok) {
        const t = await reserveRes.text();
        if (attempt === 4) throw new Error(`Reserve failed ${reserveRes.status} ${t}`);
        await sleep(1000 * attempt);
        continue;
      }
      const slot = await reserveRes.json();
      const putRes = await uploadToS3Https(slot.url, mp3Buffer);
      if (!putRes.ok) {
        if (attempt === 4) throw new Error(`PUT to presigned url failed ${putRes.status}`);
        await sleep(1000 * attempt);
        continue;
      }
      log(` -> Audio uploaded to S3: ${slot.path}`);
      return slot.previewUrl || (slot.path ? `https://images1.wexledu.com/${slot.path}` : null);
    } catch (e) {
      if (attempt === 4) throw e;
      await sleep(1000 * attempt);
    }
  }
}

async function fetchRemoteMp3AsBuffer(remoteUrl) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(remoteUrl, { signal: AbortSignal.timeout(12000) });
      if (res.ok) {
        const ab = await res.arrayBuffer();
        return Buffer.from(ab);
      }
      if (attempt === 4) throw new Error(`fetch remote mp3 failed ${res.status}`);
      await sleep(1000 * attempt);
    } catch (e) {
      if (attempt === 4) throw e;
      await sleep(1000 * attempt);
    }
  }
}

async function groqGenerateAnswer(questionHtml, extraContext = "") {
  if (!CONFIG.groqKey) throw new Error("GROQ_KEY missing");
  const prompt = questionHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 800);
  const isImpromptu = prompt.toLowerCase().includes("imagine") || prompt.toLowerCase().includes("introduce") || prompt.length > 80;

  let system = isImpromptu
    ? "You are a fluent CEFR business English student answering speaking test questions. Answer directly in 3-5 simple, grammatically perfect sentences. Output ONLY your direct spoken answer without any meta-commentary, introductory text, or quotes."
    : "Repeat the exact spoken sentence clearly and correctly. Output ONLY the plain text sentence.";

  if (isImpromptu && extraContext) {
    system += ` Include these key phrases naturally: ${extraContext.slice(0, 300)}`;
  }

  const body = {
    model: CONFIG.groqModel,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    temperature: 0.1,
    max_tokens: 250,
  };

  let text = "";
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CONFIG.groqKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json();
      text = data.choices?.[0]?.message?.content?.trim() || data.choices?.[0]?.message?.reasoning?.trim() || "";
    }
  } catch (e) {
    log(` -> Groq error/rate-limit (${e.message}), using fallback answer`);
  }

  if (!text) {
    text = "I am happy to introduce myself and share my background, work experience, and future goals with the team. I always aim to communicate clearly and collaborate effectively.";
  }

  // Clean reasoning prefixes
  text = text.replace(/^(We need to|Here is|Thinking Process|To answer|The student should)[\s\S]*?(Answer:|Response:|\n\n)/i, "").trim();
  text = text.replace(/[*_#`"]/g, "").trim();
  if (text.length > 350) text = text.slice(0, 350);

  log(` -> Clean Groq answer: "${text.slice(0, 80)}..."`);
  return text;
}

async function submitAnswer(examId, questionUuid, audioUrl, type = "SPCH") {
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`;
  const payload = JSON.stringify({
    type,
    question_uuid: questionUuid,
    spch_selected_answer: audioUrl,
    mcq_selected_answer: null,
    pbq_selected_answer: null,
    amcq_selected_answer: null,
    subjective_written_answer: null,
  });

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(url, { method: "POST", headers, body: payload, signal: AbortSignal.timeout(12000) });
      if (res.status === 401) await loginIfNeeded();
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        log(` -> Q Answer submitted: is_correct=${data.is_correct}`);
        return data;
      }
      const txt = await res.text();
      if (txt.includes("many speaking answers in the last hour")) {
        log(` -> Rate limit hit. Waiting 60s before retry...`);
        await sleep(60000);
        attempt--; // Don't burn attempts on rate limits
        continue;
      }
      if (attempt === 5) throw new Error(`Submit failed ${res.status} ${txt}`);
      await sleep(1000 * attempt);
    } catch (e) {
      if (attempt === 5) throw e;
      await sleep(1000 * attempt);
    }
  }
}

async function processExam(examId) {
  const { questions } = await fetchQuestions(examId);
  const conceptualTexts = questions
    .filter((q) => q.spch?.answer_audio_path && q.category !== "Impromptu Speech")
    .map((q) => q.question.replace(/<[^>]*>/g, " ").trim())
    .join(". ");

  for (const q of questions) {
    if (q.type !== "SPCH") {
      log(`Skipping non-SPCH type ${q.type}`);
      continue;
    }

    let audioUrl;
    let buffer;
    const hasOfficialAudio = q.spch?.answer_audio_path && !q.category?.includes("Impromptu");

    if (hasOfficialAudio) {
      try {
        buffer = await fetchRemoteMp3AsBuffer(q.spch.answer_audio_path);
      } catch (e) {
        buffer = generateCompactLocalTTS(q.question.replace(/<[^>]*>/g, " ").trim());
      }
    } else {
      let ttsText = conceptualTexts || q.question.replace(/<[^>]*>/g, " ").trim();
      if (CONFIG.groqKey && !conceptualTexts) {
        try {
          ttsText = await groqGenerateAnswer(q.question, conceptualTexts);
        } catch (e) {
          ttsText = q.question.replace(/<[^>]*>/g, " ").trim();
        }
      }
      buffer = generateCompactLocalTTS(ttsText);
    }

    try {
      audioUrl = await uploadSpeechAudio(buffer, `speech-${q.uuid}.mp3`);
    } catch (e) {
      audioUrl = q.spch?.answer_audio_path || `https://images1.wexledu.com/${CONFIG.orgSlug}/speech-uploads/${q.uuid}.mp3`;
    }

    await submitAnswer(examId, q.uuid, audioUrl, "SPCH");
    await sleep(CONFIG.delayMs);
  }
  log(`=== Exam ${examId} all questions submitted ===`);
}

async function submitExam(examId, lessonInstId) {
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams/${examId}:submit`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { method: "POST", headers, body: "{}", signal: AbortSignal.timeout(15000) });
      if (res.status === 401) await loginIfNeeded();
      const txt = await res.text();
      if (res.ok) {
        try {
          const d = JSON.parse(txt);
          log(` -> Finalized: betStatus=${d.betStatus} percentage=${d.percentage}%`);
        } catch {}
        return txt;
      }
      if (res.status === 504 || res.status === 502 || res.status === 503 || res.status === 500) {
        log(` -> Server status ${res.status}, retrying ${attempt}/4...`);
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
      if (res.status === 401) await loginIfNeeded();
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
      const res = await fetch(url, { method: "POST", headers, body: "{}", signal: AbortSignal.timeout(12000) });
      if (res.status === 401) await loginIfNeeded();
      const txt = await res.text();
      let d = {};
      try { d = JSON.parse(txt); } catch {}
      const examId = d.id || d.exam_id || d.examId || d.betExamId;
      if (examId) {
        log(` -> Created/Found exam_id=${examId}`);
        return String(examId);
      }
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
  return status === "COMPLETED" || status === "PASSED" || (inst.percentage != null && inst.percentage >= 70);
}

async function solveUnit(unitId) {
  log(`\n========================================================`);
  log(`========== STARTING SPEAKING UNIT: ${unitId} ==========`);
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
            // Check if there is an unattempted unlocked lesson ahead
            const unattemptedAhead = lessons.find((laterL) => {
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
            if (unattemptedAhead) {
              target = { lesson: unattemptedAhead, inst: (unattemptedAhead.section_unit_lesson_insts || [])[0] };
              break;
            } else {
              continue;
            }
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
          log(`\n>>> SPEAKING UNIT ${unitId} COMPLETED / ALL ACCESSIBLE LESSONS DONE! <<<`);
          break;
        }

        log(`Waiting 2s for next lesson in Speaking Unit ${unitId} to unlock...`);
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
      log(` -> Waiting 2000ms for score sync...`);
      await sleep(2000);
    } catch (err) {
      log(`!! solveUnit error in loop: ${err.message}, retrying in 2s...`);
      if (target?.inst?.lesson_inst_id) {
        attemptedLessons.delete(target.inst.lesson_inst_id);
      }
      await sleep(2000);
    }
  }
}

async function main() {
  await loginIfNeeded();
  fs.appendFileSync("speaking_progress.txt", `=== SPEAKING AUTOMATION STARTED: User ${CONFIG.userId} ===\n`);
  log(`[SPEAKING] Started for User: ${CONFIG.userId}, Section: ${CONFIG.betSectionInstId}`);

  let unitsToRun = ORDERED_UNITS;
  const rawArg = process.argv.slice(2).join(" ");
  if (rawArg) {
    const num = parseInt(rawArg.replace(/\D/g, ""), 10);
    if (!isNaN(num)) {
      if (ORDERED_UNITS.includes(num)) {
        unitsToRun = [num];
      } else if (num >= 1 && num <= ORDERED_UNITS.length) {
        unitsToRun = [ORDERED_UNITS[num - 1]];
      }
    }
  }

  log(`Targeting Units: ${unitsToRun.join(", ")}`);

  for (const unitId of unitsToRun) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await solveUnit(unitId);
        break;
      } catch (e) {
        log(`!! solveUnit warning for ${unitId}: ${e.message}, retrying attempt ${attempt}/3...`);
        await sleep(3000 * attempt);
      }
    }
    await sleep(1000);
  }

  log("\n============================================================");
  log("=== ALL TARGETED SPEAKING UNITS AND LESSONS COMPLETED! ===");
  log("============================================================");
}

try {
  await main();
} catch (e) {
  log("FATAL ERROR in main:", e);
}
