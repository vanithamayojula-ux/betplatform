import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userEmail: "12505970@lpu.in",
  userPassCombo: [
    { username: "12505970@lpu.in", password: "12505970@lpu.in" },
    { username: "12505970@lpu.in", password: "12505970" },
    { username: "12505970", password: "12505970@lpu.in" },
    { username: "12505970", password: "12505970" }
  ],
  userId: "12505970",
  lessonInstId: "6293994" // Lesson 10
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function login() {
  for (const c of CONFIG.userPassCombo) {
    try {
      const res = await fetch(`${CONFIG.baseUrl}/api/public/bet-exams/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: c.username, password: c.password, appContext: "BET_CORPORATE" })
      });
      if (res.ok) {
        const d = await res.json();
        const raw = d.jwtToken || d.token || d.id_token;
        if (raw) return raw.startsWith("Bearer ") ? raw : "Bearer " + raw;
      }
    } catch (e) {}
  }
}

async function uploadAudio(buffer, auth) {
  const reserveUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userEmail}/speech-question:upload`;
  const reserveRes = await fetch(reserveUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: "{}"
  });
  const slot = await reserveRes.json();
  const putRes = await fetch(slot.url, {
    method: "PUT",
    headers: { "Content-Length": String(buffer.length) },
    body: buffer
  });
  if (!putRes.ok) throw new Error(`PUT failed: ${putRes.status}`);
  return slot.previewUrl || (slot.path ? `https://images1.wexledu.com/${slot.path}` : null);
}

async function fetchGoogleTTSBuffer(text) {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text.slice(0, 250))}&tl=en&client=tw-ob`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  return Buffer.from(await res.arrayBuffer());
}

async function solveL10() {
  const auth = await login();
  const headers = { Authorization: auth, "Content-Type": "application/json" };

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

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    let buffer;
    if (q.spch?.answer_audio_path) {
      console.log(`Q${i+1}: Fetching official audio...`);
      const aRes = await fetch(q.spch.answer_audio_path);
      buffer = Buffer.from(await aRes.arrayBuffer());
    } else if (i === 0) {
      const text = "I would like to introduce my colleague David Miller, who is our Lead Software Architect. An interesting fact about him is that he has published two books on cloud computing and loves hiking on weekends.";
      console.log(`Q1 [Introduce colleague]: "${text}"`);
      buffer = await fetchGoogleTTSBuffer(text);
    } else {
      const text = "Hello, welcome to our team! My name is Alex, and I work as a frontend developer on this project. What specific areas or technologies will you be focusing on in your new role?";
      console.log(`Q2 [Meet new team member]: "${text}"`);
      buffer = await fetchGoogleTTSBuffer(text);
    }

    const audioUrl = await uploadAudio(buffer, auth);
    console.log(`Q${i+1} audio URL: ${audioUrl}`);

    const ansUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`;
    const ansRes = await fetch(ansUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ type: "SPCH", question_uuid: q.uuid, spch_selected_answer: audioUrl })
    });
    console.log(`Q${i+1} submit status: ${ansRes.status}`);
    const txt = await ansRes.text();
    if (ansRes.status !== 200) console.log(`Q${i+1} error text:`, txt);
  }

  // 3. Submit exam
  const subUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${CONFIG.lessonInstId}/bet-exams/${examId}:submit`;
  const subRes = await fetch(subUrl, { method: "POST", headers, body: "{}" });
  const result = await subRes.json();
  console.log(`\n=== FINAL RESULT ===`);
  console.log(JSON.stringify(result, null, 2));
}

solveL10().catch(console.error);
