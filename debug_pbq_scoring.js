import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12520776",
  userEmail: "12520776@lpu.in",
  userPass: "12520776",
  authToken: process.env.TOKEN,
};

const headers = { "Content-Type": "application/json" };
if (CONFIG.authToken) headers["Authorization"] = CONFIG.authToken;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function loginIfNeeded() {
  const url = `${CONFIG.baseUrl}/api/public/bet-exams/login`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: CONFIG.userEmail, password: CONFIG.userPass, appContext: "BET_CORPORATE" }),
    });
    if (res.ok) {
      const data = await res.json();
      const rawToken = data.jwtToken || data.token || data.id_token;
      if (rawToken) {
        const token = rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`;
        CONFIG.authToken = token;
        headers["Authorization"] = token;
        return token;
      }
    }
  } catch (e) {}
}

async function main() {
  await loginIfNeeded();
  const lessonInstId = "8253745"; // Reading Topic 2 L3

  const createRes = await fetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams`, { method: "POST", headers, body: "{}" });
  const exam = await createRes.json();
  console.log("Created exam:", exam.id);

  const qRes = await fetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${exam.id}/questions`, { headers });
  const qData = await qRes.json();
  const q = qData.test_definition_section[0].questions[0];

  console.log("Question UUID:", q.uuid);
  const passage = q.question;

  // Let's test different answer payloads for PBQ
  const answers = [];
  for (let i = 0; i < q.pbq.length; i++) {
    const subQ = q.pbq[i];
    console.log(`SubQ ${i+1}: "${subQ.question}" UUID=${subQ.uuid}`);
    console.log("Options:", subQ.mcq);
    // Let's pick 1, 2, 3, 4 etc
    answers.push({
      type: "MCQ",
      mcq: {
        selected_answer: 2, // e.g. option 2
        question_uuid: subQ.uuid
      }
    });
  }

  const payload = {
    type: "PBQ",
    question_uuid: q.uuid,
    pbq_selected_answer: {
      answers: answers
    }
  };

  console.log("Submitting Pass 1 payload...");
  const subRes = await fetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${exam.id}/answers`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  const subJson = await subRes.json();
  console.log("Pass 1 response marks_scored:", subJson.marks_scored);

  // Extract correct answers from subJson.pbq
  const exactAnswers = (subJson.pbq || []).map(p => ({
    type: "MCQ",
    mcq: {
      selected_answer: p.mcq?.answer || 1,
      question_uuid: p.uuid
    }
  }));

  const pass2Payload = {
    type: "PBQ",
    question_uuid: q.uuid,
    pbq_selected_answer: {
      answers: exactAnswers
    }
  };

  console.log("Submitting Pass 2 exact answers payload...");
  const pass2Res = await fetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${exam.id}/answers`, {
    method: "POST",
    headers,
    body: JSON.stringify(pass2Payload)
  });
  const pass2Json = await pass2Res.json();
  console.log("Pass 2 response marks_scored:", pass2Json.marks_scored, "is_correct:", pass2Json.is_correct);

  // Submit exam
  const evalRes = await fetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams/${exam.id}:submit`, {
    method: "POST",
    headers,
    body: "{}"
  });
  console.log("Submit exam response:", await evalRes.text());
}

main().catch(console.error);
