import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12505612",
  authToken: process.env.TOKEN,
};

const headers = {
  "Content-Type": "application/json",
  Authorization: CONFIG.authToken,
};

function getBestOption(q) {
  const opts = [q.amcq?.option1, q.amcq?.option2, q.amcq?.option3, q.amcq?.option4];
  const exp = (q.explanation || "").toLowerCase();
  
  for (let i = 0; i < opts.length; i++) {
    if (opts[i] && exp.includes(opts[i].toLowerCase())) {
      return i + 1;
    }
  }

  let bestScore = -1;
  let bestIdx = 0;
  const expWords = exp.split(/[^a-z0-9]+/).filter(w => w.length > 2);

  opts.forEach((opt, idx) => {
    if (!opt) return;
    const optWords = opt.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2);
    let matches = 0;
    optWords.forEach(w => {
      const stem = w.slice(0, 4);
      if (expWords.some(ew => ew.includes(stem) || stem.includes(ew.slice(0, 4)))) {
        matches++;
      }
    });
    const score = optWords.length > 0 ? matches / optWords.length : 0;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  });

  return bestIdx + 1;
}

async function test() {
  const examId = "673388000";
  const lessonInstId = "6805510";

  const qUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/questions`;
  const qRes = await fetch(qUrl, { headers });
  const qData = await qRes.json();
  const questions = (qData.test_definition_section || []).flatMap(s => s.questions || []);

  for (const q of questions) {
    const pick = getBestOption(q);
    const ansUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`;
    const ansPayload = {
      type: q.type,
      question_uuid: q.uuid,
      amcq_selected_answer: pick,
      mcq_selected_answer: null,
      pbq_selected_answer: null,
      spch_selected_answer: null,
      subjective_written_answer: null,
    };
    const ansRes = await fetch(ansUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(ansPayload),
    });
    const ansData = await ansRes.json();
    console.log(`Submitted Q ${q.id}: is_correct=${ansData.is_correct} (pick=${pick})`);
  }

  console.log("Submitting exam...");
  const subUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams/${examId}:submit`;
  const subRes = await fetch(subUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
  const subText = await subRes.text();
  console.log("Submit result:", subText);
}

test().catch(console.error);
