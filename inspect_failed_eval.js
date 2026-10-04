import "dotenv/config";
import fs from "fs";

function log(msg) {
  const str = typeof msg === "object" ? JSON.stringify(msg, null, 2) : String(msg);
  fs.appendFileSync("eval_log.txt", str + "\n");
  console.log(str);
}

fs.writeFileSync("eval_log.txt", "INSPECTING EVALUATIONS...\n");

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
}

async function inspect() {
  const token = await login();
  const headers = { "Content-Type": "application/json", Authorization: token };

  const lessons = [
    { instId: "8136342", name: "L2 Crafting a Subject Line", examId: "675220150" },
    { instId: "8145377", name: "L11 Rewrite casual sentences", examId: "676342050" },
    { instId: "8145410", name: "L12 Rearrange an email", examId: "676342100" },
    { instId: "8145451", name: "L13 Spot and correct errors", examId: "676342150" },
  ];

  for (const l of lessons) {
    log(`\n========================================================`);
    log(`>>> ${l.name} (examId=${l.examId}) <<<`);
    log(`========================================================`);

    const qRes = await fetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${l.examId}/questions`, { headers });
    const qData = await qRes.json();
    const questions = (qData.test_definition_section || []).flatMap(s => s.questions || []);

    for (const q of questions) {
      log(`\n--- Question ID: ${q.id} (uuid: ${q.uuid}) ---`);
      log(`Text: ${q.question}`);
      log(`Rubric / Meta: ${JSON.stringify(q.rubric || q.metadata || q.evaluation || {}, null, 2)}`);

      // Evaluate API call detail
      const evRes = await fetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/bet-exams/${l.examId}/writing-evaluation?question_uuid=${q.uuid}`, {
        method: "POST", headers, body: "{}"
      });
      const evData = await evRes.json().catch(() => ({}));
      log(`Evaluation Response: ${JSON.stringify(evData, null, 2)}`);
    }
  }
}

inspect().catch(e => log("FATAL: " + e.stack));
