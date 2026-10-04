import "dotenv/config";
import https from "https";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12518334",
  authToken: process.env.TOKEN,
  betSectionInstId: "177439",
};

const headers = { "Content-Type": "application/json" };
if (CONFIG.authToken) headers["Authorization"] = CONFIG.authToken;

function customFetch(urlStr) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = https.request({
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: "GET",
      headers,
      rejectUnauthorized: false
    }, (res) => {
      let body = "";
      res.on("data", c => body += c);
      res.on("end", () => resolve(JSON.parse(body)));
    });
    req.on("error", reject);
    req.end();
  });
}

async function inspectUnit(unitId) {
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.betSectionInstId}/bet-section-unit-insts/${unitId}/bet-section-unit-lesson-insts`;
  const lessons = await customFetch(url);
  console.log(`\n=== UNIT ${unitId} ===`);
  for (const l of lessons) {
    const inst = (l.section_unit_lesson_insts || [])[0];
    if (!inst) continue;
    console.log(`L${l.seq_no} (${l.lesson_name}): status=${l.lesson_status}, pct=${inst.percentage}`);
    // Create exam to inspect questions if unlocked or failed
    if (l.lesson_status !== "LOCKED") {
      const examUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${inst.lesson_inst_id}/bet-exams`;
      try {
        const createRes = await new Promise((res, rej) => {
          const u = new URL(examUrl);
          const r = https.request({ hostname: u.hostname, port: 443, path: u.pathname, method: "POST", headers }, resp => {
            let b = ""; resp.on("data", c => b += c); resp.on("end", () => res(JSON.parse(b)));
          });
          r.write("{}"); r.end();
        });
        const examId = createRes.id;
        const qUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/questions`;
        const qRes = await customFetch(qUrl);
        const questions = (qRes.test_definition_section || []).flatMap(s => s.questions || []);
        for (const q of questions) {
          console.log(`   Q [${q.uuid}] (${q.type}): ${q.question.replace(/<[^>]*>/g, " ")}`);
        }
      } catch (e) {
        console.log(`   (Failed to fetch exam questions: ${e.message})`);
      }
    }
  }
}

async function main() {
  await inspectUnit(941820);
  await inspectUnit(941805);
}

main().catch(console.error);
