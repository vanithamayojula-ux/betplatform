import "dotenv/config";
import fs from "fs";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12505612",
  userEmail: "12505612@lpu.in",
  userPass: "12505612",
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
  let log = "";
  try {
    const loginRes = await fetch(`${CONFIG.baseUrl}/api/public/bet-exams/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: CONFIG.userEmail,
        password: CONFIG.userPass,
        appContext: "BET_CORPORATE",
      }),
    });
    const loginData = await loginRes.json();
    const rawToken = loginData.jwtToken || loginData.token || loginData.id_token;
    const token = rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`;

    const headers = { Authorization: token };
    
    // Get lesson insts for Unit 941831
    const lRes = await fetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/177430/bet-section-unit-insts/941831/bet-section-unit-lesson-insts`, { headers });
    const lessons = await lRes.json();
    
    log += `Found ${lessons.length} lessons in Unit 941831\n`;
    for (const l of lessons) {
      const inst = (l.section_unit_lesson_insts || [])[0];
      log += `L${l.seq_no} "${l.lesson_name}": bet_status=${inst?.bet_status}, pct=${inst?.percentage}%, exam_id=${inst?.exam_id}\n`;
      
      if (inst?.exam_id) {
        const qRes = await fetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${inst.exam_id}/questions`, { headers });
        if (qRes.ok) {
          const qData = await qRes.json();
          const questions = (qData.test_definition_section || []).flatMap((s) => s.questions || []);
          log += `   -> Exam ${inst.exam_id} has ${questions.length} questions\n`;
          questions.slice(0, 2).forEach((q, idx) => {
            log += `      Q${idx + 1}: type=${q.type}, category=${q.category}, spch=${JSON.stringify(q.spch)}\n`;
          });
        }
      }
    }
  } catch (e) {
    log += `ERROR: ${e.stack}\n`;
  }
  fs.writeFileSync("c:\\Users\\HP\\OneDrive\\Desktop\\betplatform\\q_inspect.txt", log, "utf8");
}

await main();
