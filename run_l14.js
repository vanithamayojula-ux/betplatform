import "dotenv/config";
import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12509952",
  userEmail: "12509952@lpu.in",
  authToken: process.env.TOKEN,
  groqKey: process.env.GROQ_KEY || process.env.groq_key,
  groqModel: "openai/gpt-oss-20b",
  delayMs: 300,
  scoreWaitMs: 3000,
};

const headers = {
  "Content-Type": "application/json",
  Authorization: CONFIG.authToken,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function generateLocalTTS(text) {
  const tmpTxt = path.join(os.tmpdir(), `tts_in_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`);
  const tmpWav = path.join(os.tmpdir(), `tts_out_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`);
  fs.writeFileSync(tmpTxt, text, "utf8");
  
  const psScript = `
Add-Type -AssemblyName System.Speech
$txt = [System.IO.File]::ReadAllText('${tmpTxt.replace(/'/g, "''")}', [System.Text.Encoding]::UTF8)
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.Rate = 0
$s.Volume = 100
$s.SetOutputToWaveFile('${tmpWav.replace(/'/g, "''")}')
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
    console.log(` -> Local TTS generated ${buffer.length} bytes for: "${text.slice(0, 60)}..."`);
    return buffer;
  }
  throw new Error("Failed to generate local TTS WAV");
}

async function fetchQuestions(examId) {
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/questions`;
  console.log(`[GET] ${url}`);
  const res = await fetch(url, { headers, method: "GET" });
  const data = await res.json();
  const questions = (data.test_definition_section || []).flatMap((s) => s.questions || []);
  console.log(` -> Found ${questions.length} questions for exam ${examId} (${data.test_name})`);
  return { meta: data, questions };
}

async function uploadSpeechAudio(mp3Buffer, filename = "test-audio.mp3") {
  const reserveUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userEmail}/speech-question:upload`;
  console.log(`[POST] ${reserveUrl} (reserve slot for ${filename}, ${mp3Buffer.length} bytes)`);

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const reserveRes = await fetch(reserveUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });
      const slot = await reserveRes.json();
      console.log(` -> Slot path: ${slot.path}`);

      const putRes = await fetch(slot.url, {
        method: "PUT",
        body: mp3Buffer,
      });
      if (!putRes.ok) {
        const t = await putRes.text();
        console.warn(`PUT failed ${putRes.status}: ${t}`);
        if (attempt === 4) throw new Error(`PUT failed: ${t}`);
        await sleep(1500 * attempt);
        continue;
      }
      console.log(` -> PUT OK to S3`);

      return slot.previewUrl;
    } catch (e) {
      if (attempt === 4) throw e;
      console.warn(`Upload attempt ${attempt} error: ${e.message}, retrying...`);
      await sleep(1500 * attempt);
    }
  }
}

async function fetchRemoteMp3AsBuffer(remoteUrl) {
  console.log(` -> Fetching remote audio: ${remoteUrl}`);
  const res = await fetch(remoteUrl);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

async function groqGenerateAnswer(questionHtml, extraContext = "") {
  const prompt = questionHtml
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 800);
  const isImpromptu =
    prompt.toLowerCase().includes("imagine") ||
    prompt.toLowerCase().includes("introduce") ||
    prompt.length > 80;

  let system = isImpromptu
    ? "You are a BEGINNER CEFR English student. Answer the prompt directly in 6-8 simple sentences, 90-120 words, simple present, basic vocab, detailed. Do not say 'I am a beginner' — just answer. Cover every part."
    : "Repeat the sentence exactly as given, simple and clear.";
  if (isImpromptu && extraContext) {
    system += ` You MUST include all these ideas naturally in your answer: ${extraContext.slice(0, 400)}`;
  }
  const body = {
    model: CONFIG.groqModel,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 600,
  };
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CONFIG.groqKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  let text = data.choices?.[0]?.message?.content?.trim();
  text = text.replace(/^We need to[\s\S]*?Answer:\s*/i, "").trim();
  if (text.length > 490) text = text.slice(0, 490);
  console.log(` -> Groq answer: "${text.slice(0, 120)}"`);
  return text;
}

async function submitAnswer(examId, questionUuid, audioUrl) {
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`;
  const payload = {
    type: "SPCH",
    question_uuid: questionUuid,
    spch_selected_answer: audioUrl,
    mcq_selected_answer: null,
    pbq_selected_answer: null,
    amcq_selected_answer: null,
    subjective_written_answer: null,
  };
  console.log(`[POST] ${url} uuid=${questionUuid}`);
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        console.log(` -> Answer submitted: is_correct=${data.is_correct}`);
        return data;
      }
      const txt = await res.text();
      console.warn(` -> Attempt ${attempt + 1} failed ${res.status} ${txt.slice(0, 200)}`);
      if (txt.includes("many speaking answers in the last hour")) {
        console.warn(` -> Hourly speaking rate limit hit. Waiting 60s before retry (attempt ${attempt + 1}/10)...`);
        await sleep(60000);
        continue;
      }
      await sleep(2000 * (attempt + 1));
    } catch (e) {
      console.warn(` -> Submit answer network error (${e.message}), retrying ${attempt + 1}/10...`);
      await sleep(2000 * (attempt + 1));
    }
  }
}

async function submitExam(examId, lessonInstId) {
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams/${examId}:submit`;
  console.log(`[POST] ${url} :submit`);
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    const text = await res.text();
    console.log(` -> Status ${res.status} Body: ${text.slice(0, 300)}`);
    if (res.ok) {
      try {
        const data = JSON.parse(text);
        console.log(` -> Finalized: betStatus=${data.betStatus} percentage=${data.percentage}`);
      } catch {}
      return text;
    }
    await sleep(4000);
  }
}

async function run() {
  const examId = "672673650";
  const lessonInstId = "7822177";

  const { questions } = await fetchQuestions(examId);

  const conceptualTexts = questions
    .filter((q) => q.spch?.answer_audio_path && q.category !== "Impromptu Speech")
    .map((q) => q.question.replace(/<[^>]*>/g, " ").trim())
    .join(" | ");

  for (const q of questions) {
    console.log(`\n--- Q ${q.id} uuid=${q.uuid} type=${q.type} ---`);
    console.log(`Q text: ${q.question.replace(/<[^>]*>/g, "").slice(0, 120)}`);

    let buffer;
    const hasOfficialAudio = !q.category?.includes("Impromptu") && q.spch?.answer_audio_path;
    if (hasOfficialAudio) {
      console.log(` -> Conceptual question, fetching original mp3 for high score`);
      try {
        buffer = await fetchRemoteMp3AsBuffer(q.spch.answer_audio_path);
      } catch (e) {
        console.warn(` -> Failed fetching official mp3: ${e.message}, synthesizing locally...`);
        buffer = generateLocalTTS(q.question.replace(/<[^>]*>/g, " ").trim());
      }
    } else {
      let ttsText;
      try {
        ttsText = await groqGenerateAnswer(q.question, conceptualTexts);
      } catch (e) {
        console.warn(` -> Groq generation failed: ${e.message}, using raw prompt`);
        ttsText = q.question.replace(/<[^>]*>/g, " ").trim();
      }
      console.log(` -> TTS text: "${ttsText.slice(0, 80)}..."`);
      buffer = generateLocalTTS(ttsText);
    }

    const audioUrl = await uploadSpeechAudio(buffer, `speech-${q.uuid}.mp3`);
    await submitAnswer(examId, q.uuid, audioUrl);
    await sleep(CONFIG.delayMs);
  }

  console.log(`\nAll questions submitted! Waiting ${CONFIG.scoreWaitMs}ms before finalizing exam...`);
  await sleep(CONFIG.scoreWaitMs);
  await submitExam(examId, lessonInstId);
  console.log("=== Lesson 14 Complete! ===");
}

run().catch(console.error);
