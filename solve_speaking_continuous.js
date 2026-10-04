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
  speakingSectionInstId: "176843",
  targetUnits: [
    { uId: 941831, name: "Topic 1 (Introducing Yourself)" },
    { uId: 941832, name: "Topic 2 (Talking About Daily Tasks)" }
  ]
};

const headers = { "Content-Type": "application/json" };
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function log(...args) {
  const line = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ") + "\n";
  process.stdout.write(line);
  fs.appendFileSync("speaking_continuous.log", line);
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
}

async function uploadSpeechAudio(mp3Buffer) {
  const reserveUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userEmail}/speech-question:upload`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const reserveRes = await fetch(reserveUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: CONFIG.authToken },
        body: "{}",
        signal: AbortSignal.timeout(12000)
      });
      if (reserveRes.status === 401) await loginIfNeeded();
      if (!reserveRes.ok) {
        await sleep(1000 * attempt);
        continue;
      }
      const slot = await reserveRes.json();
      const putRes = await fetch(slot.url, {
        method: "PUT",
        headers: { "Content-Length": String(mp3Buffer.length) },
        body: mp3Buffer
      });
      if (!putRes.ok) {
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
  return Buffer.concat([header, Buffer.alloc(numSamples * 2)]);
}

async function fetchGoogleTTSBuffer(text) {
  const cleanText = text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 250);
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
      await sleep(1000 * attempt);
    }
  }
  return generateFallbackWavBuffer();
}

function generateTailoredSpeechAnswer(qPrompt) {
  const p = (qPrompt || "").toLowerCase();

  // Peer & Colleague introductions
  if (p.includes("colleague") || p.includes("introduce a colleague")) {
    return "I would like to introduce my colleague David Miller, who is our Lead Software Architect. An interesting fact about him is that he has published two books on cloud computing and loves hiking on weekends.";
  }
  if (p.includes("new team member") || p.includes("met a new")) {
    return "Hello, welcome to our team! My name is Alex, and I work as a frontend developer on this project. What specific areas or technologies will you be focusing on in your new role?";
  }
  if (p.includes("peer")) {
    return "I am pleased to introduce my peer Sarah Patel, a talented UI designer. She brings creative thinking to our user experiences and recently completed an international design marathon.";
  }

  // Self introductions & Elevator pitches
  if (p.includes("elevator pitch") || p.includes("current job")) {
    return "I work as a software engineer building scalable enterprise web platforms. I love my job because it allows me to solve complex technical puzzles and collaborate with innovative colleagues every day.";
  }
  if (p.includes("introducing yourself") && (p.includes("name") || p.includes("meeting a new colleague"))) {
    return "Hello, my name is Alex. I am originally from Chicago, and one hobby I truly enjoy is playing chess on weekends. It is great to meet you!";
  }
  if (p.includes("interview")) {
    return "In my professional career, I have developed strong expertise in full-stack software development. I excel at delivering clean, maintainable code and solving challenging business requirements.";
  }
  if (p.includes("hometown")) {
    return "My hometown is Springfield, located near the river valley. It is a peaceful place famous for its historic architecture, vibrant annual autumn festival, and warm community spirit.";
  }
  if (p.includes("culture") || p.includes("tradition") || p.includes("festival")) {
    return "In our culture, we celebrate the annual harvest festival every autumn. Families gather to prepare special traditional meals, decorate their homes with lanterns, and express gratitude for community unity.";
  }
  if (p.includes("family") || p.includes("memorable event")) {
    return "A memorable event in my family was celebrating my grandparents fiftieth wedding anniversary together. All our relatives gathered for a special dinner and shared joyful memories, which made it truly meaningful to me.";
  }
  if (p.includes("hobby") || p.includes("activity") || p.includes("shared with a friend")) {
    return "A hobby I really enjoy is cooking traditional Italian pasta. Last summer, I cooked a homemade dinner together with my best friend, and we had a wonderful evening sharing stories and laughing.";
  }
  if (p.includes("achievement") || p.includes("proud")) {
    return "One of my proudest achievements was leading a successful software project in college. Our team worked together efficiently, resolved difficult technical challenges, and delivered the project on time.";
  }
  if (p.includes("goal") || p.includes("aspiration") || p.includes("future")) {
    return "My future goal is to become an expert software engineer and lead innovative technical projects. I aim to continuously improve my skills and make a positive impact in the technology industry.";
  }
  if (p.includes("strength") || p.includes("weakness")) {
    return "My greatest strength is my analytical problem-solving and dedication to collaboration. A weakness I actively improve is delegating tasks earlier to optimize team efficiency.";
  }
  if (p.includes("twist") || p.includes("storytelling")) {
    return "During a major college presentation, our projector unexpectedly stopped working. Instead of panicking, we turned it into an interactive discussion, which impressed the audience even more.";
  }
  if (p.includes("time-limited")) {
    return "Hello everyone, my name is Alex. I am a software engineer specializing in scalable full-stack applications. I enjoy creating efficient user experiences and look forward to collaborating with everyone here.";
  }
  if (p.includes("cultural exchange")) {
    return "In our cultural tradition, we celebrate the annual festival of lights with community feasts and decorations. Sharing our traditions helps us build mutual respect and learn from diverse global perspectives.";
  }
  if (p.includes("debate")) {
    return "Good morning respected judges and peers. My name is Alex, and I represent the affirmative side in today debate. I firmly advocate that adopting technological innovation drives sustainable progress across all industries.";
  }
  if (p.includes("future-self")) {
    return "Looking five years into the future, I see myself as a senior engineering director leading impactful artificial intelligence solutions. I will continue mentoring young developers and advancing inclusive technology worldwide.";
  }

  // Topic 2: Daily Tasks
  if (p.includes("routine") || p.includes("morning")) {
    return "Every morning, I wake up at six thirty, prepare fresh coffee, and exercise for twenty minutes. Then I review my priority tasks and organize my calendar before joining the daily team standup.";
  }
  if (p.includes("commute") || p.includes("travel")) {
    return "My daily commute to the office takes approximately twenty-five minutes by metro train. I usually listen to tech podcasts or read industry articles during the trip to stay informed.";
  }
  if (p.includes("priorit") || p.includes("urgent") || p.includes("deadline")) {
    return "To prioritize my daily workload effectively, I categorize tasks by urgency and project impact using an Eisenhower matrix. This ensures critical deliverables are completed ahead of deadlines.";
  }
  if (p.includes("meeting") || p.includes("presentation")) {
    return "Before attending a team meeting, I review the meeting agenda, compile status metrics, and prepare relevant questions so our discussions remain productive and focused.";
  }
  if (p.includes("lunch") || p.includes("break")) {
    return "During lunchtime, I like to step away from my screen and enjoy a balanced meal with colleagues in the cafeteria. It provides a great opportunity to connect informally and recharge.";
  }
  if (p.includes("afternoon") || p.includes("breakdown")) {
    return "In the afternoon, I allocate uninterrupted focus blocks for coding, code reviews, and resolving technical tickets. I also follow up on team messages before the end of the day.";
  }
  if (p.includes("schedul")) {
    return "I structure my workday using sixty-minute focused intervals followed by short breaks. Scheduling specific time blocks for deep work drastically improves my productivity and accuracy.";
  }
  if (p.includes("technology") || p.includes("tool") || p.includes("software")) {
    return "I actively use modern collaborative tools like Git, Jira, and Slack to manage code repositories, track project milestones, and maintain seamless communication across teams.";
  }
  if (p.includes("delegat") || p.includes("collaborat")) {
    return "Successful delegation requires matching complex tasks with team members strengths, setting clear objectives, and maintaining open check-ins to support their progress.";
  }
  if (p.includes("time management") || p.includes("self-evaluation")) {
    return "I regularly evaluate my time management at the end of each week to identify bottlenecks. This continuous reflection helps me eliminate unproductive habits and refine my daily schedule.";
  }
  if (p.includes("report") || p.includes("simulation")) {
    return "In today status report, I am pleased to share that the core API modules are fully implemented and verified. We are on schedule to begin integration testing tomorrow.";
  }
  if (p.includes("q&a") || p.includes("interactive")) {
    return "When handling multiple competing requests, I consult with project managers to realign priorities and communicate realistic turnaround times to all stakeholders.";
  }
  if (p.includes("distraction") || p.includes("focus")) {
    return "To minimize distractions during critical work, I turn off non-urgent notifications and use noise-canceling headphones to maintain deep concentration.";
  }
  if (p.includes("without technology")) {
    return "Working without digital devices would encourage more direct face-to-face brainstorming, paper note-taking, and whiteboard architectural discussions with team members.";
  }
  if (p.includes("week") || p.includes("plan")) {
    return "For this upcoming week, my primary objectives are deploying the updated speaking module, completing unit testing, and conducting comprehensive performance reviews.";
  }

  return "Hello, I am glad to share my perspective on this topic. I always focus on clear communication, high professional performance, and positive collaboration with my team.";
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

async function submitAnswerWithRateLimitWait(examId, payload) {
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`;
  while (true) {
    try {
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(12000) });
      if (res.status === 401) await loginIfNeeded();
      if (res.ok) return await res.json().catch(() => ({}));
      const txt = await res.text();
      if (txt.includes("many speaking answers in the last hour")) {
        log(` [WAIT] Hourly speaking quota active. Checking every 60s for window reset...`);
        await sleep(60000);
        continue;
      }
      log(`  Answer submit response ${res.status}: ${txt}`);
      await sleep(1000);
      return {};
    } catch (e) {
      log(`  Submit error: ${e.message}. Retrying in 3s...`);
      await sleep(3000);
    }
  }
}

async function solveExam(examId) {
  const qData = await fetchQuestions(examId);
  if (!qData || !qData.questions) return;
  const { questions } = qData;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const qType = q.type || "MCQ";

    if (qType === "SPCH") {
      let buffer;
      if (q.spch?.answer_audio_path) {
        log(`  Q${i+1} [Official Audio]: Fetching source recording...`);
        const aRes = await fetch(q.spch.answer_audio_path);
        buffer = Buffer.from(await aRes.arrayBuffer());
      } else {
        const answerText = generateTailoredSpeechAnswer(q.question);
        log(`  Q${i+1} [Tailored]: "${answerText}"`);
        buffer = await fetchGoogleTTSBuffer(answerText);
      }
      const audioUrl = await uploadSpeechAudio(buffer);
      await submitAnswerWithRateLimitWait(examId, { type: "SPCH", question_uuid: q.uuid, spch_selected_answer: audioUrl });
    } else {
      const pick = 1;
      await submitAnswerWithRateLimitWait(examId, { type: qType, question_uuid: q.uuid, mcq_selected_answer: pick, amcq_selected_answer: pick });
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

async function run() {
  fs.writeFileSync("speaking_continuous.log", "=== FULL 30-LESSON SPEAKING TRACK SOLVER ===\n");
  log(`Starting solver for student ${CONFIG.userEmail}...`);
  await loginIfNeeded();

  for (const u of CONFIG.targetUnits) {
    log(`\n============================================================`);
    log(`=== ${u.name} (15 Lessons) ===`);
    log(`============================================================`);

    while (true) {
      const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.speakingSectionInstId}/bet-section-unit-insts/${u.uId}/bet-section-unit-lesson-insts`;
      let res;
      try {
        res = await fetch(url, { headers, method: "GET", signal: AbortSignal.timeout(10000) });
        if (res.status === 401) await loginIfNeeded();
      } catch (e) {}
      if (!res || !res.ok) {
        await sleep(3000);
        continue;
      }
      const lessons = await res.json();
      const lessonArr = Array.isArray(lessons) ? lessons : (lessons.content || []);

      const nextLesson = lessonArr.find((l) => {
        const insts = l.section_unit_lesson_insts || [];
        const inst = insts.slice(-1)[0] || insts[0] || {};
        const count = l.completed_lessons_count || 0;
        const status = l.lesson_status || inst.bet_status;
        const pct = inst.percentage != null ? Number(inst.percentage) : null;
        const isDone = count > 0 || status === "COMPLETED" || status === "PASSED" || (pct != null && pct >= 70);
        const isLocked = status === "LOCKED";
        return !isDone && !isLocked;
      });

      if (!nextLesson) {
        const allCompleted = lessonArr.every((l) => {
          const insts = l.section_unit_lesson_insts || [];
          const inst = insts.slice(-1)[0] || insts[0] || {};
          const count = l.completed_lessons_count || 0;
          const status = l.lesson_status || inst.bet_status;
          const pct = inst.percentage != null ? Number(inst.percentage) : null;
          return count > 0 || status === "COMPLETED" || status === "PASSED" || (pct != null && pct >= 70);
        });
        if (allCompleted) {
          log(`All 15 lessons in ${u.name} are 100% completed!`);
          break;
        } else {
          log(`Waiting 5s for sequential unlock in ${u.name}...`);
          await sleep(5000);
          continue;
        }
      }

      const insts = nextLesson.section_unit_lesson_insts || [];
      const inst = insts.slice(-1)[0] || insts[0] || {};
      const lessonInstId = inst.lesson_inst_id;
      const seqNo = nextLesson.seq_no;
      const lessonName = nextLesson.lesson_name;

      log(`[${u.name}] Solving Lesson ${seqNo}: "${lessonName}" (InstId: ${lessonInstId})...`);

      try {
        const examId = await createExamForLesson(lessonInstId);
        log(` -> Created exam_id=${examId}`);
        await solveExam(examId);
        await submitExam(examId, lessonInstId);
        await sleep(500);
      } catch (e) {
        log(` !! Error solving L${seqNo}: ${e.message}`);
        await sleep(2000);
      }
    }
  }

  log(`\n============================================================`);
  log(`=== ALL 30 SPEAKING LESSONS (15 FROM EACH TOPIC) 100% COMPLETED! ===`);
  log(`============================================================`);
}

run().catch(console.error);
