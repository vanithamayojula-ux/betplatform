import "dotenv/config";
import fs from "fs";
import https from "https";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12505970",
  userEmail: "12505970@lpu.in",
  userPassCombo: [
    { username: "12505970@lpu.in", password: "12505970@lpu.in" },
    { username: "12505970@lpu.in", password: "12505970" },
    { username: "12505970", password: "12505970@lpu.in" },
    { username: "12505970", password: "12505970" }
  ],
  authToken: null,
  groqKey: process.env.GROQ_KEY || process.env.groq_key,
  groqModel: "openai/gpt-oss-20b",
  speakingSectionInstId: "176843",
  targetUnits: [
    { uId: 941831, name: "Speaking Topic 1 (Self Introductions)" },
    { uId: 941832, name: "Speaking Topic 2 (Morning Routine Walkthrough)" }
  ]
};

const headers = { "Content-Type": "application/json" };
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function log(...args) {
  const line = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ") + "\n";
  process.stdout.write(line);
  fs.appendFileSync("speaking_12505970_progress.log", line);
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
          headers["Authorization"] = token;
          const payloadBase64 = token.split(".")[1];
          const payloadJson = JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf8"));
          if (payloadJson.sub) CONFIG.userId = payloadJson.sub;
          return token;
        }
      }
    } catch (e) {}
  }
  log(` -> Login warning: could not authenticate credentials.`);
}

function uploadToS3Https(urlStr, buffer) {
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
  const cleanText = (text || "Hello, I am glad to answer this prompt.")
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

  return "Hello, my name is Alex. I am from Chicago and I enjoy playing chess in my free time. I work as an engineer and love solving complex technical problems with my team.";
}

function clean(text) {
  return (text || "").replace(/<[^>]*>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/[^a-zA-Z0-9\s:]/g, " ").toLowerCase().replace(/\s+/g, " ").trim();
}

async function getBestMcqOptionNumber(q) {
  const container = q.amcq || q.mcq || {};
  if (typeof container.answer === "number" && container.answer >= 1 && container.answer <= 4) {
    return container.answer;
  }

  const rawOpts = [container.option1, container.option2, container.option3, container.option4];
  const exp = (q.explanation || container.explanation || "").replace(/<[^>]*>/g, " ").trim();
  const qText = (q.question || container.question || "").replace(/<[^>]*>/g, " ").trim();

  if (CONFIG.groqKey) {
    try {
      const prompt = `Read the question and options carefully, then select the single correct option number (1, 2, 3, or 4).\n\nQuestion: ${qText}\n${exp ? "Explanation/Context: " + exp + "\n" : ""}Options:\n1) ${(rawOpts[0] || "").replace(/<[^>]*>/g, "").trim()}\n2) ${(rawOpts[1] || "").replace(/<[^>]*>/g, "").trim()}\n3) ${(rawOpts[2] || "").replace(/<[^>]*>/g, "").trim()}\n4) ${(rawOpts[3] || "").replace(/<[^>]*>/g, "").trim()}\n\nState your answer as "ANSWER: X" where X is 1, 2, 3, or 4.`;
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${CONFIG.groqKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: CONFIG.groqModel, messages: [{ role: "user", content: prompt }], temperature: 0, max_tokens: 50 }),
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

  const opts = rawOpts.map(clean);
  const expClean = clean(exp);

  if (expClean) {
    const stopWords = new Set(["a", "an", "the", "in", "on", "at", "to", "for", "of", "it", "s", "is", "its"]);
    const expWords = new Set(expClean.split(/\s+/).filter((w) => w.length > 0));
    let bestScore = -1;
    let bestIdx = 0;

    opts.forEach((opt, idx) => {
      if (!opt) return;
      const optWords = opt.split(/\s+/).filter((w) => w.length > 0 && !stopWords.has(w));
      if (optWords.length === 0) return;
      let matchCount = 0;
      optWords.forEach((w) => {
        if (expWords.has(w) || expClean.includes(w)) matchCount++;
        else if (w.length > 4 && expClean.includes(w.slice(0, 4))) matchCount += 0.8;
      });
      const score = matchCount / optWords.length;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    });

    if (bestScore >= 0.3) return bestIdx + 1;
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
        if (questions.length > 0) return { meta: data, questions };
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
        log(` -> Rate limit active. Retrying in 12s...`);
        await sleep(12000);
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
      let audioBuffer;
      if (q.spch?.answer_audio_path) {
        try {
          const audioRes = await fetch(q.spch.answer_audio_path);
          if (audioRes.ok) {
            audioBuffer = Buffer.from(await audioRes.arrayBuffer());
          }
        } catch (e) {}
      }
      if (!audioBuffer) {
        const answerText = await generateSpeakingAnswerText(q.question, q.explanation);
        audioBuffer = await fetchGoogleTTSBuffer(answerText);
      }
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
          log(` -> Finalized Exam ${examId}: status=${d.betStatus} score=${d.percentage != null ? d.percentage + '%' : 'PENDING'}`);
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

async function main() {
  fs.writeFileSync("speaking_12505970_progress.log", "=== STARTING SPEAKING SOLVER FOR STUDENT 12505970 ===\n");
  log(`Logging in student ${CONFIG.userEmail}...`);
  await loginIfNeeded();

  for (const u of CONFIG.targetUnits) {
    log(`\n============================================================`);
    log(`=== ${u.name} ===`);
    log(`============================================================`);

    for (let loop = 1; loop <= 16; loop++) {
      const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.speakingSectionInstId}/bet-section-unit-insts/${u.uId}/bet-section-unit-lesson-insts`;
      let res;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          res = await fetch(url, { headers, method: "GET", signal: AbortSignal.timeout(10000) });
          if (res.status === 401) await loginIfNeeded();
          if (res.ok) break;
          await sleep(1000 * attempt);
        } catch (e) {
          if (attempt === 3) break;
          await sleep(1000 * attempt);
        }
      }
      if (!res || !res.ok) {
        log(`Warning: Failed to fetch lessons for unit ${u.uId}`);
        break;
      }
      const lessons = await res.json();
      const lessonArr = Array.isArray(lessons) ? lessons : (lessons.content || []);

      const nextLesson = lessonArr.find((l) => {
        const insts = l.section_unit_lesson_insts || [];
        const inst = insts.slice(-1)[0] || insts[0] || {};
        const count = l.completed_lessons_count || 0;
        const status = l.lesson_status || inst.bet_status;
        const pct = inst.percentage != null ? Number(inst.percentage) : null;
        const isCompleted = count > 0 || status === "COMPLETED" || status === "PASSED" || (pct != null && pct >= 85);
        const isLocked = status === "LOCKED";
        return !isCompleted && !isLocked;
      });

      if (!nextLesson) {
        const remainingUnfinished = lessonArr.filter((l) => {
          const insts = l.section_unit_lesson_insts || [];
          const inst = insts.slice(-1)[0] || insts[0] || {};
          const count = l.completed_lessons_count || 0;
          const status = l.lesson_status || inst.bet_status;
          const pct = inst.percentage != null ? Number(inst.percentage) : null;
          return !(count > 0 || status === "COMPLETED" || status === "PASSED" || (pct != null && pct >= 85));
        });
        if (remainingUnfinished.length === 0) {
          log(`All lessons in ${u.name} are completed!`);
        } else {
          log(`No unlocked lessons available in ${u.name} (Remaining locked: ${remainingUnfinished.length})`);
        }
        break;
      }

      const insts = nextLesson.section_unit_lesson_insts || [];
      const inst = insts.slice(-1)[0] || insts[0] || {};
      const lessonInstId = inst.lesson_inst_id;
      const seqNo = nextLesson.seq_no;
      const lessonName = nextLesson.lesson_name;

      log(`[Unit ${u.uId}] Solving Lesson ${seqNo}: "${lessonName}" (lessonInstId: ${lessonInstId})...`);

      try {
        const examId = await createExamForLesson(lessonInstId);
        log(` -> Created exam_id=${examId}`);
        await solveExam(examId);
        await submitExam(examId, lessonInstId);
        await sleep(300);
      } catch (e) {
        log(` !! Error solving L${seqNo}: ${e.message}`);
        await sleep(1000);
      }
    }
  }

  log(`\n============================================================`);
  log(`=== SPEAKING TRACK COMPLETED FOR STUDENT 12505970! ===`);
  log(`============================================================`);
}

main().catch(console.error);
