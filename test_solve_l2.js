import "dotenv/config";
import https from "https";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userEmail: "12505970@lpu.in",
  userPass: "12505970@lpu.in",
  userId: "12505970",
  lessonInstId: "6293990" // L2
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function login() {
  const combos = [
    { username: "12505970@lpu.in", password: "12505970@lpu.in" },
    { username: "12505970@lpu.in", password: "12505970" },
    { username: "12505970", password: "12505970@lpu.in" },
    { username: "12505970", password: "12505970" }
  ];
  for (const c of combos) {
    try {
      const res = await fetch(`${CONFIG.baseUrl}/api/public/bet-exams/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: c.username, password: c.password, appContext: "BET_CORPORATE" })
      });
      if (res.ok) {
        const data = await res.json();
        const raw = data.jwtToken || data.token || data.id_token;
        if (raw) return raw.startsWith("Bearer ") ? raw : "Bearer " + raw;
      }
    } catch (e) {}
  }
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

async function uploadSpeechAudio(mp3Buffer, headers) {
  const reserveUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userEmail}/speech-question:upload`;
  const reserveRes = await fetch(reserveUrl, { method: "POST", headers, body: "{}" });
  const slot = await reserveRes.json();
  const putRes = await uploadToS3Https(slot.url, mp3Buffer);
  return slot.previewUrl || (slot.path ? `https://images1.wexledu.com/${slot.path}` : null);
}

async function fetchGoogleTTSBuffer(text) {
  const cleanText = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=en&client=tw-ob`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  return Buffer.from(await res.arrayBuffer());
}

async function testL2() {
  const auth = await login();
  const headers = { "Content-Type": "application/json", Authorization: auth };

  // 1. Create exam
  const examUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${CONFIG.lessonInstId}/bet-exams`;
  const examRes = await fetch(examUrl, { method: "POST", headers, body: "{}" });
  const examData = await examRes.json();
  const examId = examData.id;
  console.log(`Created exam: ${examId}`);

  // 2. Fetch questions
  const qUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/questions`;
  const qRes = await fetch(qUrl, { headers });
  const qData = await qRes.json();
  const questions = (qData.test_definition_section || []).flatMap(s => s.questions || []);
  console.log(`Questions count: ${questions.length}`);

  // 3. Solve questions
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    let audioBuffer;

    if (q.spch?.answer_audio_path) {
      console.log(`Q${i+1}: Using official audio from ${q.spch.answer_audio_path}`);
      const audioRes = await fetch(q.spch.answer_audio_path);
      audioBuffer = Buffer.from(await audioRes.arrayBuffer());
    } else {
      console.log(`Q${i+1}: Generating TTS for impromptu question`);
      let text = "Hello, my name is Alex. I am from Chicago and I enjoy playing chess in my free time. I am a software engineer and I love solving complex technical problems with my team.";
      audioBuffer = await fetchGoogleTTSBuffer(text);
    }

    const audioUrl = await uploadSpeechAudio(audioBuffer, headers);
    console.log(`Q${i+1}: Audio uploaded -> ${audioUrl}`);

    const ansUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`;
    const ansRes = await fetch(ansUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ type: "SPCH", question_uuid: q.uuid, spch_selected_answer: audioUrl })
    });
    console.log(`Q${i+1}: Answer submitted -> HTTP ${ansRes.status}`);
  }

  // 4. Submit exam
  const submitUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${CONFIG.lessonInstId}/bet-exams/${examId}:submit`;
  const subRes = await fetch(submitUrl, { method: "POST", headers, body: "{}" });
  const subData = await subRes.json();
  console.log(`\nSUBMIT RESULT:`);
  console.log(JSON.stringify(subData, null, 2));
}

testL2().catch(console.error);
