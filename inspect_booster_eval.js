import "dotenv/config";
import fs from "fs";

function log(msg) {
  const str = typeof msg === "object" ? JSON.stringify(msg, null, 2) : String(msg);
  fs.appendFileSync("booster_eval_log.txt", str + "\n");
  console.log(str);
}

fs.writeFileSync("booster_eval_log.txt", "INSPECTING BOOSTER EVALUATIONS...\n");

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12505612",
  userEmail: "12505612@lpu.in",
  userPass: "12505612",
  authToken: process.env.TOKEN,
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function login() {
  const url = `${CONFIG.baseUrl}/api/public/bet-exams/login`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: CONFIG.userEmail,
        password: CONFIG.userPass,
        appContext: "BET_CORPORATE",
      }),
    });
    const data = await res.json();
    const rawToken = data.jwtToken || data.token || data.id_token;
    return rawToken ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`) : CONFIG.authToken;
  } catch (e) {
    return CONFIG.authToken;
  }
}

async function inspect() {
  const token = await login();
  const headers = { Authorization: token };

  const exams = [
    { examId: "676350300", name: "L2 Crafting a Subject Line" },
    { examId: "676350400", name: "L11 Rewrite casual sentences" },
    { examId: "676350600", name: "L12 Rearrange an email" },
  ];

  for (const ex of exams) {
    log(`\n========================================================`);
    log(`>>> ${ex.name} (examId=${ex.examId}) <<<`);
    log(`========================================================`);

    const qRes = await fetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${ex.examId}/questions`, { headers });
    const qData = await qRes.json();
    const questions = (qData.test_definition_section || []).flatMap(s => s.questions || []);

    for (const q of questions) {
      const evRes = await fetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/bet-exams/${ex.examId}/writing-evaluation?question_uuid=${q.uuid}`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: token }, body: "{}"
      });
      const evData = await evRes.json().catch(() => ({}));
      log(`Question ${q.id} (uuid: ${q.uuid}):`);
      log(`Answer submitted: "${evData.student_answer}"`);
      log(`Marks: ${evData.evaluation?.marks_awarded} / ${evData.evaluation?.total_marks}`);
      log(`Feedback: ${JSON.stringify(evData.evaluation?.feedback_to_student || {}, null, 2)}`);
      log(`Rubric: ${JSON.stringify(evData.evaluation?.rubric || {}, null, 2)}`);
    }
  }
}

inspect().catch(e => log("FATAL: " + e.stack));
