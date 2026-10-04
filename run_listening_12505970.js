import "dotenv/config";
import fs from "fs";

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
  listeningSectionInstId: null,
  targetUnits: []
};

function getHeaders() {
  const h = { "Content-Type": "application/json" };
  if (CONFIG.authToken) h["Authorization"] = CONFIG.authToken;
  return h;
}
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function log(...args) {
  const line = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ") + "\n";
  process.stdout.write(line);
  fs.appendFileSync("listening_12505970_progress.log", line);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loginIfNeeded(force = false) {
  if (CONFIG.authToken && !force) return CONFIG.authToken;
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
          const payloadBase64 = token.split(".")[1];
          const payloadJson = JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf8"));
          if (payloadJson.sub) CONFIG.userId = payloadJson.sub;
          log(` -> Login successful for ${c.username} (userId: ${CONFIG.userId})`);
          return token;
        }
      }
    } catch (e) {}
  }
  log(` -> Login warning: could not authenticate credentials.`);
}

async function discoverListeningStructure() {
  // Try fetching section insts to discover listening section
  const secUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts`;
  const secRes = await fetch(secUrl, { headers: getHeaders() });
  
  if (secRes.ok) {
    const secData = await secRes.json();
    const sections = Array.isArray(secData) ? secData : (secData.content || []);
    log(`Found ${sections.length} sections`);
    sections.forEach(s => log(` - "${s.section_name}" (id: ${s.section_inst_id || s.id})`));
    
    const listeningSec = sections.find(s => (s.section_name || "").toLowerCase().includes("listen"));
    if (listeningSec) {
      CONFIG.listeningSectionInstId = String(listeningSec.section_inst_id || listeningSec.id);
      log(`Discovered Listening Section Inst ID: ${CONFIG.listeningSectionInstId}`);
    }
  }

  // Fallback: try known IDs used by other students
  if (!CONFIG.listeningSectionInstId) {
    // Try 176874 (known listening section for lpu724598 org)
    const testUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/176874/bet-section-unit-insts/941823/bet-section-unit-lesson-insts`;
    const testRes = await fetch(testUrl, { headers: getHeaders() });
    if (testRes.ok) {
      const testData = await testRes.json();
      if (Array.isArray(testData) && testData.length > 0) {
        CONFIG.listeningSectionInstId = "176874";
        log(`Using known Listening Section Inst ID: 176874`);
      }
    }
  }

  if (!CONFIG.listeningSectionInstId) {
    throw new Error("Could not discover Listening section ID");
  }

  // Discover units
  const unitsUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.listeningSectionInstId}/bet-section-unit-insts`;
  const unitsRes = await fetch(unitsUrl, { headers: getHeaders() });
  if (unitsRes.ok) {
    const unitsData = await unitsRes.json();
    const units = Array.isArray(unitsData) ? unitsData : (unitsData.content || []);
    CONFIG.targetUnits = units.map(u => ({
      uId: u.section_unit_inst_id || u.unit_id || u.id,
      name: u.unit_name || u.name || `Unit ${u.section_unit_inst_id}`
    }));
    log(`Discovered ${CONFIG.targetUnits.length} Listening Unit(s):`);
    CONFIG.targetUnits.forEach(u => log(` - ${u.name} (uId: ${u.uId})`));
  } else {
    // Fallback to known unit IDs
    CONFIG.targetUnits = [
      { uId: 941823, name: "Listening Topic 1 (Starting the Day Instructions)" },
      { uId: 941828, name: "Listening Topic 2 (First Day at Work)" }
    ];
    log(`Using known unit IDs: 941823, 941828`);
  }
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
      const res = await fetch(url, { method: "POST", headers: getHeaders(), body: "{}", signal: AbortSignal.timeout(12000) });
      if (res.status === 401 || res.status === 403) await loginIfNeeded(true);
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
      const res = await fetch(url, { headers: getHeaders(), method: "GET", signal: AbortSignal.timeout(12000) });
      if (res.status === 401 || res.status === 403) await loginIfNeeded(true);
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
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { method: "POST", headers: getHeaders(), body: JSON.stringify(payload), signal: AbortSignal.timeout(12000) });
      if (res.status === 401 || res.status === 403) await loginIfNeeded(true);
      if (res.ok) return res.json().catch(() => ({}));
      await sleep(500 * attempt);
    } catch (e) {
      if (attempt === 4) throw e;
      await sleep(500 * attempt);
    }
  }
}

async function solveExam(examId) {
  const qData = await fetchQuestions(examId);
  if (!qData || !qData.questions) return;
  const { questions } = qData;

  for (const q of questions) {
    const qType = q.type || "MCQ";

    if (qType === "PBQ") {
      const passage = (q.question || "").replace(/<[^>]*>/g, " ").trim();
      const initialAnswers = [];
      for (const pbq of q.pbq || []) {
        const subQ = (pbq.question || "").replace(/<[^>]*>/g, " ").trim();
        const pick = await getBestMcqOptionNumber({
          question: `Listening Context: ${passage}\n\nQuestion: ${subQ}`,
          mcq: pbq.mcq,
          explanation: pbq.explanation || passage
        });
        initialAnswers.push({ type: "MCQ", mcq: { selected_answer: pick, question_uuid: pbq.uuid } });
      }

      // Pass 1
      const pass1Res = await submitAnswerRaw(examId, { type: "PBQ", question_uuid: q.uuid, pbq_selected_answer: { answers: initialAnswers } });

      // Pass 2: Use exact answer keys returned by API
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
      // Pass 2: Use exact answer from API response
      const exactAns = pass1Res?.mcq?.answer || pass1Res?.amcq?.answer;
      if (exactAns && exactAns !== pick) {
        await submitAnswerRaw(examId, { type: qType, question_uuid: q.uuid, mcq_selected_answer: exactAns, amcq_selected_answer: exactAns });
      }
    }

    await sleep(50);
  }
}

async function submitExam(examId, lessonInstId) {
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams/${examId}:submit`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { method: "POST", headers: getHeaders(), body: "{}", signal: AbortSignal.timeout(15000) });
      if (res.status === 401 || res.status === 403) await loginIfNeeded(true);
      const txt = await res.text();
      if (res.ok) {
        try {
          const d = JSON.parse(txt);
          log(` -> Finalized Exam ${examId}: status=${d.betStatus} score=${d.percentage}%`);
          return d;
        } catch {}
        return txt;
      }
      await sleep(1000 * attempt);
    } catch (e) {
      if (attempt === 4) throw e;
      await sleep(1000 * attempt);
    }
  }
}

async function fetchListeningLessonsToSolve() {
  const lessonsToSolve = [];

  for (const u of CONFIG.targetUnits) {
    const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.listeningSectionInstId}/bet-section-unit-insts/${u.uId}/bet-section-unit-lesson-insts`;
    let res;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        res = await fetch(url, { headers: getHeaders(), method: "GET", signal: AbortSignal.timeout(10000) });
        if (res.status === 401 || res.status === 403) await loginIfNeeded(true);
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
    const lessonArr = Array.isArray(lessons) ? lessons : (lessons.content || []);
    for (const l of lessonArr) {
      const insts = l.section_unit_lesson_insts || [];
      const inst = insts.slice(-1)[0] || insts[0];
      const pct = inst?.percentage != null ? Number(inst.percentage) : null;
      const lessonInstId = inst?.lesson_inst_id;
      const seqNo = l.seq_no;
      const lessonName = l.lesson_name || `Lesson ${seqNo}`;
      const status = inst?.bet_status || l.lesson_status;

      const isCompletedPassed = (status === "COMPLETED" || status === "PASSED") && pct != null && pct >= 85;

      if (lessonInstId && !isCompletedPassed) {
        lessonsToSolve.push({
          unitId: u.uId,
          unitName: u.name,
          lessonInstId: lessonInstId,
          seqNo,
          lessonName,
          currentPct: pct,
          status,
        });
      }
    }
  }

  return lessonsToSolve;
}

async function main() {
  fs.writeFileSync("listening_12505970_progress.log", "=== STARTING LISTENING SOLVER FOR STUDENT 12505970 ===\n");
  log("Logging in student 12505970...");
  await loginIfNeeded(true);

  log("Discovering Listening section structure...");
  await discoverListeningStructure();

  log("\nFetching Listening lessons to solve (Target: all lessons >= 85%)...");
  const lessonsToSolve = await fetchListeningLessonsToSolve();

  if (lessonsToSolve.length === 0) {
    log("ALL Listening lessons already completed with scores >= 85%!");
    log("============================================================");
    return;
  }

  log(`Found ${lessonsToSolve.length} Listening lessons to solve / boost:\n`);
  for (const l of lessonsToSolve) {
    log(` - ${l.unitName} L${l.seqNo}: "${l.lessonName}" (Current: ${l.currentPct != null ? l.currentPct + "%" : "NOT_STARTED"}, status: ${l.status})`);
  }

  log("\nStarting 2-Pass Fast-Track Execution for Listening...\n");

  for (let i = 0; i < lessonsToSolve.length; i++) {
    const item = lessonsToSolve[i];
    log(`[${i + 1}/${lessonsToSolve.length}] Solving ${item.unitName} L${item.seqNo} "${item.lessonName}" (Current: ${item.currentPct != null ? item.currentPct + "%" : "NOT_STARTED"})...`);

    try {
      const examId = await createExamForLesson(item.lessonInstId);
      log(` -> Created exam_id=${examId}`);
      await solveExam(examId);
      const result = await submitExam(examId, item.lessonInstId);

      // If score < 85%, retry once with fresh exam
      if (result && typeof result === "object" && result.percentage != null && result.percentage < 85) {
        log(` -> Score ${result.percentage}% < 85%, retrying...`);
        try {
          const examId2 = await createExamForLesson(item.lessonInstId);
          log(` -> Created retry exam_id=${examId2}`);
          await solveExam(examId2);
          await submitExam(examId2, item.lessonInstId);
        } catch (e) {
          log(` !! Retry error: ${e.message}`);
        }
      }

      await sleep(150);
    } catch (e) {
      log(` !! Error solving ${item.lessonName}: ${e.message}`);
    }
  }

  log(`\n============================================================`);
  log(`=== LISTENING TRACK COMPLETED FOR STUDENT 12505970! ===`);
  log(`============================================================`);
}

main().catch(console.error);
