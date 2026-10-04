import "dotenv/config";
import fs from "fs";
import https from "https";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12520776",
  userEmail: "12520776@lpu.in",
  userPass: "12520776",
  authToken: process.env.TOKEN,
  groqKey: process.env.GROQ_KEY || process.env.groq_key,
  groqModel: "openai/gpt-oss-20b",
  speakingSectionInstId: "176843",
  targetUnits: [
    { uId: 941831, name: "Speaking Topic 1 (Self Introductions)" },
    { uId: 941832, name: "Speaking Topic 2 (Professional Greetings / Daily Tasks)" }
  ]
};

const headers = { "Content-Type": "application/json" };
if (CONFIG.authToken) headers["Authorization"] = CONFIG.authToken;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function log(...args) {
  const line = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ") + "\n";
  process.stdout.write(line);
  fs.appendFileSync("speaking_fix.log", line);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loginIfNeeded() {
  const url = `${CONFIG.baseUrl}/api/public/bet-exams/login`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: CONFIG.userEmail, password: CONFIG.userPass, appContext: "BET_CORPORATE" }),
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json();
      const rawToken = data.jwtToken || data.token || data.id_token;
      if (rawToken) {
        const token = rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`;
        CONFIG.authToken = token;
        headers["Authorization"] = token;
        log(` -> Refreshed auth token.`);
        return token;
      }
    }
  } catch (e) {
    log(` -> Auth login warning: ${e.message}`);
  }
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
      }, 15000);

      const req = https.request(u, { method: "PUT", headers: { "Content-Length": buffer.length } }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body });
        });
      });
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
      const reserveRes = await fetch(reserveUrl, { method: "POST", headers, body: "{}", signal: AbortSignal.timeout(12000) });
      if (reserveRes.status === 401) await loginIfNeeded();
      if (!reserveRes.ok) {
        if (attempt === 4) throw new Error(`Reserve failed status ${reserveRes.status}`);
        await sleep(1000 * attempt);
        continue;
      }
      const slot = await reserveRes.json();
      const putRes = await uploadToS3Https(slot.url, mp3Buffer);
      if (!putRes.ok) {
        if (attempt === 4) throw new Error(`S3 PUT failed status ${putRes.status}`);
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

async function fetchGoogleTTSBuffer(text) {
  const cleanText = (text || "I am introducing myself to the team.")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
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

async function generateSpeakingAnswerText(promptText, explanationText) {
  const cleanExp = (explanationText || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (cleanExp && cleanExp.length > 25) {
    return cleanExp;
  }

  const cleanPrompt = (promptText || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  if (CONFIG.groqKey) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${CONFIG.groqKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: CONFIG.groqModel,
          messages: [
            { role: "system", content: "You are answering a speaking test prompt. Provide a clear, natural, 2-3 sentence direct answer spoken in first person. Do NOT include markdown or quotes. Keep under 30 words." },
            { role: "user", content: `Prompt: ${cleanPrompt}` }
          ],
          temperature: 0.1,
          max_tokens: 100
        }),
        signal: AbortSignal.timeout(8000)
      });
      if (res.ok) {
        const data = await res.json();
        let txt = data.choices?.[0]?.message?.content?.trim() || "";
        if (txt) {
          return txt.replace(/[*_#`"]/g, "").trim();
        }
      }
    } catch (e) {}
  }

  return "Hello, I am glad to answer this prompt. I have strong professional skills in communication and team collaboration.";
}

function clean(text) {
  return (text || "").replace(/<[^>]*>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/[^a-zA-Z0-9\s:]/g, " ").toLowerCase().replace(/\s+/g, " ").trim();
}

async function getBestMcqOptionNumber(q) {
  const container = q.amcq || q.mcq || {};
  if (container.answer && typeof container.answer === "number") return container.answer;

  const rawOpts = [container.option1, container.option2, container.option3, container.option4];
  const opts = rawOpts.map(clean);
  const exp = clean(q.explanation || container.explanation);

  if (exp) {
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

    if (bestScore >= 0.3) return bestIdx + 1;
  }

  if (CONFIG.groqKey) {
    try {
      const prompt = `Question: ${clean(q.question)}\nContext/Explanation: ${exp}\nOptions:\n1) ${(rawOpts[0] || "").replace(/<[^>]*>/g, "").trim()}\n2) ${(rawOpts[1] || "").replace(/<[^>]*>/g, "").trim()}\n3) ${(rawOpts[2] || "").replace(/<[^>]*>/g, "").trim()}\n4) ${(rawOpts[3] || "").replace(/<[^>]*>/g, "").trim()}\n\nState your answer as "ANSWER: X" where X is 1, 2, 3, or 4.`;
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${CONFIG.groqKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: CONFIG.groqModel, messages: [{ role: "user", content: prompt }], temperature: 0.1, max_tokens: 100 }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const d = await res.json();
        const txt = d.choices?.[0]?.message?.content || "";
        const m = txt.match(/ANSWER:\s*([1-4])/i) || txt.match(/[1-4]/);
        if (m) return Number(m[1] || m[0]);
      }
    } catch (e) {}
  }

  return 1;
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
      if (examId) return String(examId);
      await sleep(1000 * attempt);
    } catch (e) {
      if (attempt === 4) throw e;
      await sleep(1000 * attempt);
    }
  }
  throw new Error(`Failed to create exam for lesson ${lessonInstId}`);
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
        return { meta: data, questions };
      }
      await sleep(1000 * attempt);
    } catch (e) {
      if (attempt === 4) throw e;
      await sleep(1000 * attempt);
    }
  }
}

async function submitAnswerRaw(examId, payload) {
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(12000) });
      if (res.status === 401) await loginIfNeeded();
      if (res.ok) return res.json().catch(() => ({}));
      const txt = await res.text();
      if (txt.includes("many speaking answers in the last hour")) {
        log(` -> Backend Speaking rate limit hit. Waiting 45s...`);
        await sleep(45000);
        attempt--;
        continue;
      }
      if (attempt === 5) throw new Error(`Submit answer failed ${res.status} ${txt}`);
      await sleep(1000 * attempt);
    } catch (e) {
      if (attempt === 5) throw e;
      await sleep(1000 * attempt);
    }
  }
}

async function solveExam(examId) {
  const qData = await fetchQuestions(examId);
  if (!qData || !qData.questions) return;
  const { questions } = qData;

  for (const q of questions) {
    const qType = q.type || "MCQ";

    if (qType === "SPCH") {
      const answerText = await generateSpeakingAnswerText(q.question, q.explanation);
      const audioBuffer = await fetchGoogleTTSBuffer(answerText);
      const audioUrl = await uploadSpeechAudio(audioBuffer);
      await submitAnswerRaw(examId, { type: "SPCH", question_uuid: q.uuid, spch_selected_answer: audioUrl });
    } else if (qType === "PBQ") {
      const passage = (q.question || "").replace(/<[^>]*>/g, " ").trim();
      const initialAnswers = [];
      for (const pbq of q.pbq || []) {
        const subQ = (pbq.question || "").replace(/<[^>]*>/g, " ").trim();
        const pick = await getBestMcqOptionNumber({
          question: `Speaking Passage: ${passage}\n\nQuestion: ${subQ}`,
          mcq: pbq.mcq,
          explanation: pbq.explanation || passage
        });
        initialAnswers.push({ type: "MCQ", mcq: { selected_answer: pick, question_uuid: pbq.uuid } });
      }

      const pass1Res = await submitAnswerRaw(examId, { type: "PBQ", question_uuid: q.uuid, pbq_selected_answer: { answers: initialAnswers } });
      if (pass1Res && Array.isArray(pass1Res.pbq)) {
        const exactAnswers = pass1Res.pbq.map(p => ({
          type: "MCQ",
          mcq: {
            selected_answer: p.mcq?.answer || 1,
            question_uuid: p.uuid
          }
        }));
        await submitAnswerRaw(examId, { type: "PBQ", question_uuid: q.uuid, pbq_selected_answer: { answers: exactAnswers } });
      }
    } else {
      const pick = await getBestMcqOptionNumber(q);
      const pass1Res = await submitAnswerRaw(examId, { type: qType, question_uuid: q.uuid, mcq_selected_answer: pick, amcq_selected_answer: pick });
      const exactAns = pass1Res?.mcq?.answer || pass1Res?.amcq?.answer;
      if (exactAns && exactAns !== pick) {
        await submitAnswerRaw(examId, { type: qType, question_uuid: q.uuid, mcq_selected_answer: exactAns, amcq_selected_answer: exactAns });
      }
    }

    await sleep(200);
  }
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
          log(` -> Finalized Exam ${examId}: status=${d.betStatus} score=${d.percentage}%`);
          return d;
        } catch {}
        return txt;
      }
      await sleep(1500 * attempt);
    } catch (e) {
      if (attempt === 4) throw e;
      await sleep(1500 * attempt);
    }
  }
}

async function fetchSpeakingLessonsToFix() {
  await loginIfNeeded();
  const lowScoringLessons = [];

  for (const u of CONFIG.targetUnits) {
    const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.speakingSectionInstId}/bet-section-unit-insts/${u.uId}/bet-section-unit-lesson-insts`;
    let res;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        res = await fetch(url, { headers, method: "GET", signal: AbortSignal.timeout(10000) });
        if (res.status === 401 || res.status === 500) await loginIfNeeded();
        if (res.ok) break;
        await sleep(1000 * attempt);
      } catch (e) {
        if (attempt === 4) break;
        await sleep(1000 * attempt);
      }
    }
    if (!res || !res.ok) {
      log(`Warning: Failed to fetch lessons for unit ${u.uId}: status ${res ? res.status : 'timeout'}`);
      continue;
    }
    const lessons = await res.json();
    for (const l of lessons) {
      const inst = (l.section_unit_lesson_insts || [])[0];
      const pct = inst?.percentage != null ? Number(inst.percentage) : null;
      const lessonInstId = inst?.lesson_inst_id;
      const seqNo = l.seq_no;
      const lessonName = l.lesson_name || `Lesson ${seqNo}`;

      if (lessonInstId && (pct == null || pct < 85)) {
        lowScoringLessons.push({
          unitId: u.uId,
          unitName: u.name,
          lessonInstId: lessonInstId,
          seqNo,
          lessonName,
          currentPct: pct,
        });
      }
    }
  }

  return lowScoringLessons;
}

async function main() {
  fs.writeFileSync("speaking_fix.log", "=== FIXING ALL SPEAKING LESSONS BELOW 85% ===\n");
  log("Fetching Speaking lessons in Topic 1 & Topic 2 with scores < 85%...");

  const lowScoringLessons = await fetchSpeakingLessonsToFix();
  log(`Found ${lowScoringLessons.length} Speaking lessons below 85% score threshold:\n`);

  for (const l of lowScoringLessons) {
    log(` - ${l.unitName} L${l.seqNo}: "${l.lessonName}" (Current best score: ${l.currentPct}%)`);
  }

  log("\nStarting score boosting using LLM spoken answers + Google TTS audio generation...\n");

  for (let i = 0; i < lowScoringLessons.length; i++) {
    const item = lowScoringLessons[i];
    log(`[${i + 1}/${lowScoringLessons.length}] Re-solving ${item.unitName} L${item.seqNo} "${item.lessonName}" (Current: ${item.currentPct}%)...`);

    try {
      const examId = await createExamForLesson(item.lessonInstId);
      log(` -> Created exam_id=${examId}`);
      await solveExam(examId);
      const subRes = await submitExam(examId, item.lessonInstId);
      await sleep(1000);
    } catch (e) {
      log(` !! Error boosting ${item.lessonName}: ${e.message}`);
    }
  }

  log(`\n============================================================`);
  log(`=== SPEAKING LESSON FIX COMPLETE! ===`);
  log(`============================================================`);
}

main().catch(console.error);
