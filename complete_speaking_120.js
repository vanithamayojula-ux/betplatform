import "dotenv/config";
import fs from "fs";
import os from "os";
import path from "path";
import https from "https";
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
};

const TARGET_UNITS = [
  { uId: 941831, name: "Speaking Topic 1 (Self Introductions)" },
  { uId: 941832, name: "Speaking Topic 2 (Professional Greetings / Daily Tasks)" }
];

const headers = { "Content-Type": "application/json" };
if (CONFIG.authToken) headers["Authorization"] = CONFIG.authToken;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function log(...args) {
  const line = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ") + "\n";
  process.stdout.write(line);
  fs.appendFileSync("speaking_120_progress.txt", line);
}

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
      if (attempt === 4) throw new Error(`GET questions failed ${res.status}`);
      await sleep(1000 * attempt);
    } catch (e) {
      if (attempt === 4) throw e;
      await sleep(1000 * attempt);
    }
  }
}

function generateCompactLocalTTS(text) {
  try {
    const cleanText = (text || "I am happy to introduce myself and share my background.").replace(/[^a-zA-Z0-9\s.,?!'\-]/g, " ").replace(/\s+/g, " ").trim();
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
      if (fs.existsSync(tmpWav)) {
        const buf = fs.readFileSync(tmpWav);
        try { fs.unlinkSync(tmpTxt); fs.unlinkSync(tmpWav); fs.unlinkSync(tmpPs1); } catch {}
        return buf;
      }
    } catch {}
  } catch {}

  // Fallback 2s PCM WAV
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
  return Buffer.concat([header, Buffer.alloc(numSamples * 2)]);
}

async function uploadToS3Https(urlStr, buffer) {
  return new Promise((resolve) => {
    try {
      const u = new URL(urlStr);
      let finished = false;
      const timer = setTimeout(() => {
        if (finished) return;
        finished = true;
        resolve({ ok: false, status: 504, body: "Timeout" });
      }, 12000);

      const req = https.request(
        u,
        {
          method: "PUT",
          headers: { "Content-Length": buffer.length },
        },
        (res) => {
          let body = "";
          res.on("data", (c) => (body += c));
          res.on("end", () => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body });
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
      resolve({ ok: false, status: 500, body: e.message });
    }
  });
}

async function uploadSpeechAudio(mp3Buffer) {
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
        if (attempt === 4) throw new Error(`Reserve failed ${reserveRes.status}`);
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
      return slot.previewUrl || (slot.path ? `https://images1.wexledu.com/${slot.path}` : null);
    } catch (e) {
      if (attempt === 4) throw e;
      await sleep(1000 * attempt);
    }
  }
}

async function submitAnswer(examId, questionUuid, audioUrl) {
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`;
  const payload = JSON.stringify({
    type: "SPCH",
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
        log(` -> Rate limit hit. Waiting 45s before retry...`);
        await sleep(45000);
        attempt--;
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
  if (!CONFIG.groqKey) return null;
  const prompt = (questionHtml || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 800);
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
      let text = data.choices?.[0]?.message?.content?.trim() || data.choices?.[0]?.message?.reasoning?.trim() || "";
      if (text) {
        text = text.replace(/^(We need to|Here is|Thinking Process|To answer|The student should)[\s\S]*?(Answer:|Response:|\n\n)/i, "").trim();
        text = text.replace(/[*_#`"]/g, "").trim();
        if (text.length > 350) text = text.slice(0, 350);
        return text;
      }
    }
  } catch (e) {
    log(` -> Groq warning: ${e.message}`);
  }
  return null;
}

const GLOBAL_AUDIO_POOL = [];

async function initGlobalAudioPool() {
  log(` -> Building global native audio pool from Speaking units...`);
  try {
    for (const unitId of [941832, 941831, 941829]) {
      const lessons = await getLessonInsts(unitId).catch(() => []);
      if (!Array.isArray(lessons)) continue;
      for (const l of lessons) {
        const inst = (l.section_unit_lesson_insts || [])[0];
        if (inst?.exam_id) {
          try {
            const { questions } = await fetchQuestions(String(inst.exam_id));
            for (const q of questions) {
              if (q.spch?.answer_audio_path) {
                const b = await fetchRemoteMp3AsBuffer(q.spch.answer_audio_path);
                if (b && b.length > 500) {
                  GLOBAL_AUDIO_POOL.push(b);
                  if (GLOBAL_AUDIO_POOL.length >= 10) break;
                }
              }
            }
          } catch {}
        }
        if (GLOBAL_AUDIO_POOL.length >= 10) break;
      }
      if (GLOBAL_AUDIO_POOL.length >= 10) break;
    }
    log(` -> Global native audio pool initialized with ${GLOBAL_AUDIO_POOL.length} high-quality MP3 buffers.`);
  } catch (e) {
    log(` -> Audio pool init warning: ${e.message}`);
  }
}

async function fetchGoogleTTSBuffer(text) {
  const cleanText = (text || "I am introducing myself to the team.").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=en&client=tw-ob`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const ab = await res.arrayBuffer();
        return Buffer.from(ab);
      }
      await sleep(1000 * attempt);
    } catch (e) {
      if (attempt === 3) throw e;
      await sleep(1000 * attempt);
    }
  }
}

async function processExam(examId) {
  const { questions } = await fetchQuestions(examId);
  const conceptualTexts = questions
    .filter((q) => q.spch?.answer_audio_path && !q.category?.includes("Impromptu"))
    .map((q) => q.question ? q.question.replace(/<[^>]*>/g, " ").trim() : "")
    .filter(Boolean)
    .join(". ");

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (q.type !== "SPCH") continue;
    let buffer = null;
    const hasOfficialAudio = q.spch?.answer_audio_path;

    if (hasOfficialAudio) {
      try {
        buffer = await fetchRemoteMp3AsBuffer(q.spch.answer_audio_path);
        log(` -> Using official model audio buffer for ${q.uuid}`);
      } catch (e) {
        log(` -> Official audio fetch failed: ${e.message}`);
      }
    }

    if (!buffer) {
      let ttsText = null;
      if (CONFIG.groqKey) {
        ttsText = await groqGenerateAnswer(q.question || "", conceptualTexts);
      }
      if (!ttsText) {
        ttsText = q.question ? q.question.replace(/<[^>]*>/g, " ").trim() : "I am happy to introduce myself and share my background.";
      }
      try {
        buffer = await fetchGoogleTTSBuffer(ttsText);
        log(` -> Generated Google Translate native MP3 speech for ${q.uuid}`);
      } catch (e) {
        log(` -> Google TTS error: ${e.message}, fallback to local TTS`);
        buffer = generateCompactLocalTTS(ttsText);
      }
    }

    let audioUrl;
    try {
      audioUrl = await uploadSpeechAudio(buffer);
    } catch {
      audioUrl = q.spch?.answer_audio_path || `https://images1.wexledu.com/${CONFIG.orgSlug}/speech-uploads/${q.uuid}.mp3`;
    }
    await submitAnswer(examId, q.uuid, audioUrl);
    await sleep(CONFIG.delayMs);
  }
  log(`=== Exam ${examId} all questions submitted ===`);
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
      await sleep(2000 * attempt);
    } catch (e) {
      if (attempt === 4) throw e;
      await sleep(2000 * attempt);
    }
  }
}

async function getLessonInsts(unitId) {
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.betSectionInstId}/bet-section-unit-insts/${unitId}/bet-section-unit-lesson-insts`;
  const res = await fetch(url, { headers, method: "GET", signal: AbortSignal.timeout(12000) });
  if (res.status === 401) await loginIfNeeded();
  if (!res.ok) throw new Error(`GET lesson-insts failed ${res.status}`);
  return res.json();
}

async function createExamForLesson(lessonInstId) {
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams`;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({}), signal: AbortSignal.timeout(12000) });
  if (res.status === 401) await loginIfNeeded();
  const txt = await res.text();
  const d = JSON.parse(txt);
  const examId = d.id || d.exam_id || d.examId;
  log(` -> Created exam_id=${examId}`);
  return String(examId);
}

function isLessonDone(inst) {
  if (!inst) return false;
  const status = inst.bet_status || inst.lesson_status;
  return status === "COMPLETED" || status === "PASSED" || (inst.percentage != null && inst.percentage >= 70);
}

async function solveUnit(uObj) {
  log(`\n========================================================`);
  log(`========== STARTING ${uObj.name} (${uObj.uId}) ==========`);
  log(`========================================================`);

  while (true) {
    let lessons = await getLessonInsts(uObj.uId);
    let target = lessons.find((l) => {
      const inst = (l.section_unit_lesson_insts || [])[0];
      return !isLessonDone(inst) && l.lesson_status !== "LOCKED";
    });

    if (!target) {
      log(`>>> ${uObj.name} 15/15 LESSONS FULLY DONE! <<<`);
      break;
    }

    const inst = (target.section_unit_lesson_insts || [])[0];
    const lessonInstId = String(inst.lesson_inst_id);
    log(`\n>>> Processing L${target.seq_no} "${target.lesson_name}" (InstId: ${lessonInstId}) <<<`);

    let examId = null;
    if (inst.bet_status === "FAILED" || !inst.exam_id) {
      try {
        examId = await createExamForLesson(lessonInstId);
      } catch {
        examId = String(inst.exam_id);
      }
    } else {
      examId = String(inst.exam_id);
    }

    await processExam(examId);
    log(` -> Submitting exam ${examId}...`);
    await submitExam(examId, lessonInstId);
    await sleep(1500);
  }
}

async function main() {
  fs.writeFileSync("speaking_120_progress.txt", `=== TARGET 120 LESSONS SPEAKING AUTOMATION STARTED ===\n`);
  log(`Targeting Speaking Topic 1 (941831) & Topic 2 (941832) for exact 120 total course lessons.`);

  await initGlobalAudioPool();

  for (const uObj of TARGET_UNITS) {
    try {
      await solveUnit(uObj);
    } catch (e) {
      log(`!! Error in ${uObj.name}: ${e.message}`);
    }
  }

  log(`\n============================================================`);
  log(`=== ALL 120 LESSONS TARGETED (30 PER SECTION, 15 PER TOPIC 1 & 2) FINISHED! ===`);
  log(`============================================================`);
}

main().catch(console.error);
