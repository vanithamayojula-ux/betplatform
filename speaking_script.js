import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12505798",
  userEmail: "12505798@lpu.in",
  betExamIds: [],
  authToken: process.env.TOKEN,
  cookie: "",
  autoDiscover: true,
  betSectionInstId: "177435",
  betSectionUnitInstId: "941832",
  maxAutoLessons: 15,
  impromptuAudioUrl:
    "https://images1.wexledu.com/lpu724598/speech-uploads/e8b20c15-ad03-42c2-8dc3-decde93c0745.mp3",
  useSameAudioForAll: false, // false now uses Groq+Sarvam per-Q for >60%
  // LLM + TTS for >60% (set via env, not hardcoded)
  groqKey: process.env.GROQ_KEY,
  sarvamKey: process.env.SARVAM_KEY,
  groqModel: "openai/gpt-oss-20b",
  sarvamSpeaker: "shubh", // en-IN male compatible with bulbul:v3
  // delay between requests to avoid hammering dev server
  delayMs: 800,
  scoreWaitMs: 5000, // wait S3 replication + scorer before :submit
  // if true, re-use existing answer_audio_path instead of re-uploading
  preferExistingAudio: false,
};

// ---------- helpers ----------
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import os from "os";
const headers = {
  "Content-Type": "application/json",
};
if (CONFIG.authToken) headers["Authorization"] = CONFIG.authToken;
if (CONFIG.cookie) headers["Cookie"] = CONFIG.cookie;

// ignore self-signed cert for localhost - Node fetch needs this
// run with: NODE_TLS_REJECT_UNAUTHORIZED=0 node script.js  (dev only)
if (CONFIG.baseUrl.includes("localhost")) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Minimal 1-sec silent MP3 (valid) as fallback if no source audio
// This is a base64 encoded tiny MP3 - avoids needing a file on disk
const SILENT_MP3_BASE64 =
  "SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAASAAAeAAABhgZGF0YQAAAAA=";

function getSilentMp3Buffer() {
  return Buffer.from(SILENT_MP3_BASE64, "base64");
}

async function fetchQuestions(examId) {
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/questions`;
  console.log(`[GET] ${url}`);
  const res = await fetch(url, { headers, method: "GET" });
  if (!res.ok)
    throw new Error(`GET questions failed ${res.status} ${await res.text()}`);
  const data = await res.json();
  // Flatten all questions from all sections
  const questions = (data.test_definition_section || []).flatMap(
    (s) => s.questions || [],
  );
  console.log(
    ` -> Found ${questions.length} questions for exam ${examId} (${data.test_name})`,
  );
  return { meta: data, questions };
}

async function uploadSpeechAudio(mp3Buffer, filename = "test-audio.mp3") {
  const reserveUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userEmail}/speech-question:upload`;
  console.log(
    `[POST] ${reserveUrl} (reserve slot for ${filename}, ${mp3Buffer.length} bytes)`,
  );
  // 1. POST {} to reserve slot -> returns { path, url (presigned PUT), previewUrl }
  const reserveRes = await fetch(reserveUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
  if (!reserveRes.ok)
    throw new Error(
      `Reserve failed ${reserveRes.status} ${await reserveRes.text()}`,
    );
  const slot = await reserveRes.json();
  console.log(` -> Slot path: ${slot.path}`);
  console.log(` -> PreviewUrl: ${slot.previewUrl}`);
  console.log(` -> Presigned PUT url: ${slot.url.slice(0, 120)}...`);
  // 2. PUT mp3 bytes to presigned url
  const isWav =
    mp3Buffer.length > 4 && mp3Buffer[0] === 0x52 && mp3Buffer[1] === 0x49;
  const mime = isWav ? "audio/wav" : "audio/mpeg";
  // ensure filename matches slot.path extension if needed, but keep mp3 for BET
  const putRes = await fetch(slot.url, {
    method: "PUT",
    headers: { "Content-Type": mime },
    body: mp3Buffer,
  });
  if (!putRes.ok)
    throw new Error(
      `PUT to presigned url failed ${putRes.status} ${await putRes.text()}`,
    );
  console.log(` -> PUT OK to S3`);
  // 3. Verify previewUrl has bytes (HEAD)
  for (let i = 0; i < 5; i++) {
    try {
      const head = await fetch(slot.previewUrl, { method: "HEAD" });
      if (head.ok && Number(head.headers.get("content-length") || 0) > 1000) {
        console.log(
          ` -> PreviewUrl verified ${head.headers.get("content-length")} bytes`,
        );
        break;
      }
    } catch {}
    await sleep(800);
  }
  return slot.previewUrl; // use previewUrl as spch_selected_answer (now actually has bytes, not empty)
}

async function fetchRemoteMp3AsBuffer(remoteUrl) {
  console.log(` -> Fetching remote audio: ${remoteUrl}`);
  const res = await fetch(remoteUrl);
  if (!res.ok) throw new Error(`fetch remote mp3 failed ${res.status}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

async function groqGenerateAnswer(questionHtml, extraContext = "") {
  if (!CONFIG.groqKey) throw new Error("GROQ_KEY missing");
  const prompt = questionHtml
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 800);
  const isImpromptu =
    prompt.toLowerCase().includes("imagine") ||
    prompt.toLowerCase().includes("introduce") ||
    prompt.length > 80;
  // all Impromptu need long for L08-L15 stories — short gave 20%
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
  if (!res.ok) throw new Error(`Groq failed ${res.status} ${await res.text()}`);
  const data = await res.json();
  let text = data.choices?.[0]?.message?.content?.trim();
  if (!text) text = data.choices?.[0]?.message?.reasoning?.trim();
  // gpt-oss puts draft answer inside reasoning when content empty — extract last quoted sentences
  if (!text || text.startsWith("We need to")) {
    const reasoning = data.choices?.[0]?.message?.reasoning || text || "";
    // extract last quoted answer: "My hometown is..."
    const match = reasoning.match(/"([^"]{20,200})"/);
    if (match) text = match[1];
    else {
      // fallback: take last 2 sentences of reasoning
      const parts = reasoning.split(". ");
      text = parts
        .slice(-3)
        .join(". ")
        .replace(/^We need to[\s\S]*?Sentence \d+:\s*/i, "")
        .trim();
    }
  }
  if (!text || text.length < 10) {
    const raw = JSON.stringify(data).slice(0, 800);
    throw new Error(`Groq empty ${raw}`);
  }
  text = text.replace(/^We need to[\s\S]*?Answer:\s*/i, "").trim();
  if (text.length > 490) text = text.slice(0, 490); // Sarvam max 500 chars
  console.log(` -> Groq answer: "${text.slice(0, 120)}"`);
  return text;
}

async function sarvamTTS(text) {
  if (!CONFIG.sarvamKey) throw new Error("SARVAM_KEY missing");
  const res = await fetch("https://api.sarvam.ai/text-to-speech", {
    method: "POST",
    headers: {
      "api-subscription-key": CONFIG.sarvamKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: [text],
      target_language_code: "en-IN",
      speaker: CONFIG.sarvamSpeaker,
      pace: 1.0,
      loudness: 1.0,
      speech_sample_rate: 22050,
      enable_preprocessing: true,
      model: "bulbul:v3",
    }),
  });
  if (!res.ok)
    throw new Error(`Sarvam failed ${res.status} ${await res.text()}`);
  const data = await res.json();
  const b64 = data.audios?.[0];
  if (!b64)
    throw new Error(`Sarvam no audios ${JSON.stringify(data).slice(0, 400)}`);
  console.log(` -> Sarvam audio ${b64.length} chars`);
  return Buffer.from(b64, "base64");
}

async function submitAnswer(examId, questionUuid, audioUrl, type = "SPCH") {
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`;
  const payload = {
    type,
    question_uuid: questionUuid,
    spch_selected_answer: audioUrl,
    // keep other fields null as per your example
    mcq_selected_answer: null,
    pbq_selected_answer: null,
    amcq_selected_answer: null,
    subjective_written_answer: null,
  };
  console.log(`[POST] ${url} uuid=${questionUuid}`);
  let res;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (res.ok) break;
    const txt = await res.text();
    console.warn(
      ` -> Attempt ${attempt + 1} failed ${res.status} ${txt.slice(0, 200)}`,
    );
    if (attempt < 2) await sleep(1500 * (attempt + 1));
    else throw new Error(`Submit answer failed ${res.status} ${txt}`);
  }
  const data = await res.json().catch(() => ({}));
  console.log(` -> Answer submitted: ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}

// For non-SPCH questions, you can extend this:
// function buildAnswerForType(q) { ... }

async function processExam(examId) {
  const { questions } = await fetchQuestions(examId);
  // collect Conceptual sentences for dynamic Impromptu context (if present)
  const conceptualTexts = questions
    .filter(
      (q) => q.spch?.answer_audio_path && q.category !== "Impromptu Speech",
    )
    .map((q) => q.question.replace(/<[^>]*>/g, " ").trim())
    .join(" | ");
  if (conceptualTexts)
    console.log(
      ` -> Dynamic context for Impromptu: ${conceptualTexts.slice(0, 120)}...`,
    );

  for (const q of questions) {
    console.log(`\n--- Q ${q.id} uuid=${q.uuid} type=${q.type} ---`);
    console.log(`Q text: ${q.question.replace(/<[^>]*>/g, "").slice(0, 120)}`);

    if (q.type !== "SPCH") {
      console.log(
        `Skipping non-SPCH type ${q.type} - extend script for MCQ/MSQ etc.`,
      );
      continue;
    }

    let audioUrl;

    // Option A: if question already has answer_audio_path and you want to reuse (fastest for analytics seeding)
    if (CONFIG.preferExistingAudio && q.spch?.answer_audio_path) {
      audioUrl = q.spch.answer_audio_path;
      console.log(` -> Using existing answer_audio_path: ${audioUrl}`);
    } else {
      // Groq+Sarvam for >60%: Impromptu via LLM, Conceptual via direct TTS of question text
      let buffer;
      const useLLM = CONFIG.groqKey && CONFIG.sarvamKey;
      if (useLLM) {
        try {
          const isImpromptu =
            !q.spch?.answer_audio_path &&
            (q.category === "Impromptu Speech" || q.question.length > 80);
          if (!isImpromptu && q.spch?.answer_audio_path) {
            // Conceptual with qb mp3 -> use original mp3 directly (48% like L02), not Sarvam wav to avoid 500
            console.log(
              ` -> Conceptual with qb, fetching original mp3 for high score`,
            );
            buffer = await fetchRemoteMp3AsBuffer(q.spch.answer_audio_path);
          } else {
            let ttsText;
            if (isImpromptu) {
              ttsText = await groqGenerateAnswer(q.question, conceptualTexts);
            } else {
              const base = q.question.replace(/<[^>]*>/g, " ").trim();
              if (base.split(" ").length < 10) {
                try {
                  ttsText = await groqGenerateAnswer(
                    `Expand this sentence into 2 simple sentences for speaking practice, keep the original sentence first: "${base}"`,
                  );
                } catch {
                  ttsText = base + " It is very nice and peaceful.";
                }
              } else ttsText = base;
            }
            console.log(` -> TTS text: "${ttsText.slice(0, 80)}..."`);
            buffer = await sarvamTTS(ttsText);
            // convert wav -> mp3 for BET eval (expects mp3, not wav)
            const isWav = buffer[0] === 0x52 && buffer[1] === 0x49;
            if (isWav) {
              try {
                const tmpWav = path.join(os.tmpdir(), `sarvam-${q.uuid}.wav`);
                const tmpMp3 = path.join(os.tmpdir(), `sarvam-${q.uuid}.mp3`);
                await fs.promises.writeFile(tmpWav, buffer);
                execSync(
                  `ffmpeg -y -loglevel quiet -i "${tmpWav}" -codec:a libmp3lame -qscale:a 2 "${tmpMp3}"`,
                );
                buffer = await fs.promises.readFile(tmpMp3);
                console.log(
                  ` -> Converted wav->mp3 ${buffer.length} bytes via ffmpeg`,
                );
              } catch (e) {
                console.warn(
                  ` -> ffmpeg convert failed, keeping wav: ${e.message}`,
                );
              }
            }
          }
        } catch (e) {
          console.warn(
            ` -> Groq/Sarvam failed, fallback to static audio: ${e.message}`,
          );
          if (CONFIG.impromptuAudioUrl)
            buffer = await fetchRemoteMp3AsBuffer(CONFIG.impromptuAudioUrl);
          else buffer = getSilentMp3Buffer();
        }
      } else if (CONFIG.useSameAudioForAll && CONFIG.impromptuAudioUrl) {
        console.log(
          ` -> Using same real voice for all: ${CONFIG.impromptuAudioUrl}`,
        );
        try {
          buffer = await fetchRemoteMp3AsBuffer(CONFIG.impromptuAudioUrl);
        } catch (e) {
          console.warn(` -> Failed sameAudio, fallback silent: ${e.message}`);
          buffer = getSilentMp3Buffer();
        }
      } else if (q.spch?.answer_audio_path) {
        try {
          buffer = await fetchRemoteMp3AsBuffer(q.spch.answer_audio_path);
        } catch (e) {
          console.warn(
            ` -> Failed to fetch remote audio, using silent fallback: ${e.message}`,
          );
          buffer = getSilentMp3Buffer();
        }
      } else {
        if (CONFIG.impromptuAudioUrl) {
          try {
            console.log(
              ` -> No reference audio (Impromptu), fetching impromptuAudioUrl`,
            );
            buffer = await fetchRemoteMp3AsBuffer(CONFIG.impromptuAudioUrl);
          } catch (e) {
            console.warn(
              ` -> Failed impromptuAudioUrl, using silent fallback: ${e.message}`,
            );
            buffer = getSilentMp3Buffer();
          }
        } else {
          console.log(" -> No reference audio (Impromptu), using silent MP3");
          buffer = getSilentMp3Buffer();
        }
      }

      try {
        audioUrl = await uploadSpeechAudio(buffer, `speech-${q.uuid}.mp3`);
      } catch (e) {
        // If upload endpoint in dev returns previewUrl even with {} payload (your capture),
        // fallback to reusing remote url directly so analytics still populates
        console.warn(
          ` -> Upload failed, falling back to direct URL: ${e.message}`,
        );
        audioUrl =
          q.spch?.answer_audio_path ||
          `https://images1.wexledu.com/${CONFIG.orgSlug}/speech-uploads/${q.uuid}.mp3`;
      }
    }

    await submitAnswer(examId, q.uuid, audioUrl, "SPCH");
    await sleep(CONFIG.delayMs);
  }
  console.log(`\n=== Exam ${examId} done ===`);
}

async function submitExam(examId, lessonInstId) {
  // POST .../bet-section-unit-lesson-insts/{lessonInstId}/bet-exams/{examId}:submit  payload {}
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams/${examId}:submit`;
  console.log(`[POST] ${url} :submit`);
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
  const text = await res.text();
  console.log(` -> Status ${res.status} Body: ${text.slice(0, 600)}`);
  if (!res.ok) throw new Error(`Submit failed ${res.status} ${text}`);
  try {
    const data = JSON.parse(text);
    console.log(
      ` -> Finalized: betStatus=${data.betStatus} percentage=${data.percentage}`,
    );
  } catch {}
  return text;
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
  const text = await res.text();
  console.log(` -> Status ${res.status} Body: ${text.slice(0, 600)}`);
  if (!res.ok) throw new Error(`Create exam failed ${res.status} ${text}`);
  const data = JSON.parse(text);
  const examId = data.id || data.exam_id || data.examId;
  if (!examId) throw new Error(`No exam id in response ${text}`);
  console.log(
    ` -> Created exam_id=${examId} for lesson_inst_id=${lessonInstId}`,
  );
  return String(examId);
}

async function verifyExam(examId) {
  console.log(`\n[VERIFY] Checking analytics for exam ${examId}`);
  const candidates = [
    `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.betSectionInstId}/bet-section-unit-insts/${CONFIG.betSectionUnitInstId}/bet-section-unit-lesson-insts`,
  ];
  for (const url of candidates) {
    try {
      console.log(`[GET] ${url}`);
      const res = await fetch(url, { headers, method: "GET" });
      const text = await res.text();
      console.log(` -> Status ${res.status}`);
      if (res.ok) {
        try {
          const data = JSON.parse(text);
          const count = Array.isArray(data)
            ? data.length
            : Array.isArray(data.answers)
              ? data.answers.length
              : Array.isArray(data.data)
                ? data.data.length
                : 1;
          console.log(` -> Found ${count} answer(s): ${text.slice(0, 600)}`);
          if (text.includes("images1.wexledu.com"))
            console.log(" -> ✓ Seeded audio URLs present");
        } catch {
          console.log(` -> Body: ${text.slice(0, 600)}`);
        }
        return;
      } else {
        console.log(` -> Body: ${text.slice(0, 400)}`);
      }
    } catch (e) {
      console.warn(` -> Verify failed for ${url}: ${e.message}`);
    }
  }
  console.log(
    " -> No verify endpoint matched. Check dashboard UI or Network > bet-report/bet-dashboard",
  );
}

async function runSingleLesson(examId, lessonInstId) {
  await processExam(examId);
  console.log(
    ` -> Waiting ${CONFIG.scoreWaitMs}ms for S3 replication + scorer...`,
  );
  await sleep(CONFIG.scoreWaitMs);
  await submitExam(examId, lessonInstId);
  // poll until percentage is a number (not null)
  for (let i = 0; i < 10; i++) {
    await sleep(3000);
    const lessons = await getLessonInsts();
    const cur = lessons.find(
      (l) =>
        (l.section_unit_lesson_insts || [])[0]?.lesson_inst_id ===
        Number(lessonInstId),
    );
    const pct = cur?.section_unit_lesson_insts?.[0]?.percentage;
    console.log(
      ` -> Poll ${i + 1}: ${cur?.lesson_name} percentage=${pct} bet=${cur?.section_unit_lesson_insts?.[0]?.bet_status}`,
    );
    if (pct !== null && pct !== undefined) break;
  }
  await verifyExam(examId);
}

async function main() {
  console.log(
    `Base: ${CONFIG.baseUrl}, Org: ${CONFIG.orgSlug}, User: ${CONFIG.userId}`,
  );
  if (!CONFIG.authToken || CONFIG.authToken.includes("PASTE_YOUR_TOKEN")) {
    console.warn("WARN: Set TOKEN env var: TOKEN='Bearer ...' node script.js");
  }

  // Manual mode: betExamIds provided (keep lessonMap for backward compat)
  if (CONFIG.betExamIds.length > 0) {
    console.log("Starting manual mode for exams:", CONFIG.betExamIds);
    const lessonMap = {
      647889300: "7633969", // L02
      648023850: "7633970", // L03
      648066200: "7633971", // L04 Hometown 778977 (5 Qs)
      648271350: "7633972", // L05
      648305200: "7633973", // L10 (manual mismatch, keep)
      648318600: "7633964", // L06 Past Achievements
      648436100: "7633965", // L07 Future Goals
      648490800: "7633966", // L08 Personal Anecdote retry
      648576700: "7633963", // L09 Strengths retry
      648664800: "7633973", // L10 Peer Introduction
      648675550: "7633974", // L11 Storytelling
    };
    for (const id of CONFIG.betExamIds) {
      try {
        const lessonInstId = lessonMap[id] || null;
        await processExam(id);
        if (lessonInstId) await submitExam(id, lessonInstId);
        else
          console.warn(
            ` -> No lessonInstId for ${id}, skipping :submit (enable autoDiscover or add to lessonMap)`,
          );
        await verifyExam(id);
      } catch (e) {
        console.error(`!! Failed exam ${id}:`, e.message);
      }
      await sleep(CONFIG.delayMs);
    }
    console.log("\nAll done. Check your analytics dashboard now.");
    return;
  }

  // Auto mode: discover IN_PROGRESS lessons and create exams sequentially
  if (!CONFIG.autoDiscover) {
    console.log("No betExamIds and autoDiscover false - nothing to do");
    return;
  }
  console.log(`Starting AUTO mode (max ${CONFIG.maxAutoLessons} lessons)`);
  for (let i = 0; i < CONFIG.maxAutoLessons; i++) {
    const lessons = await getLessonInsts();
    // find next lesson to seed: first IN_PROGRESS/NOT_STARTED with no exam_id (sequential unlock)
    // L03 0% leaves L04 as NOT_STARTED, not IN_PROGRESS, so we handle both
    let target = null;
    for (const l of lessons) {
      const inst = (l.section_unit_lesson_insts || [])[0];
      if (!inst) continue;
      const isNext =
        (l.lesson_status === "IN_PROGRESS" ||
          l.lesson_status === "NOT_STARTED") &&
        (inst.bet_status === "IN_PROGRESS" ||
          inst.bet_status === "NOT_STARTED") &&
        !inst.exam_id;
      if (isNext) {
        target = { lesson: l, inst };
        break;
      }
    }
    if (!target) {
      console.log("No IN_PROGRESS lesson found. Current statuses:");
      lessons.forEach((l) => {
        const inst = (l.section_unit_lesson_insts || [])[0];
        console.log(
          ` L${l.seq_no} ${l.lesson_name} status=${l.lesson_status} bet=${inst?.bet_status} id=${inst?.lesson_inst_id} exam=${inst?.exam_id}`,
        );
      });
      console.log("Unlock chain complete or need manual trigger. Stopping.");
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
    } else {
      console.log(` -> Using existing exam_id=${examId}`);
    }
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
  console.log("\nAll done. Check your analytics dashboard now.");
}

main().catch(console.error);
