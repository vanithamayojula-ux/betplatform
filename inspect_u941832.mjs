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
  return rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`;
}

async function inspectUnit941832() {
  const token = await login();
  const headers = { Authorization: token };
  
  const u = 941832;
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/177430/bet-section-unit-insts/${u}/bet-section-unit-lesson-insts`;
  const res = await fetch(url, { headers });
  console.log("Unit 941832 status:", res.status);
  if (res.ok) {
    const list = await res.json();
    console.log(`Unit 941832 has ${list.length} lessons:`);
    list.forEach(l => {
      const inst = (l.section_unit_lesson_insts || [])[0];
      console.log(` - L${l.seq_no} "${l.lesson_name}": status=${l.lesson_status}, bet_status=${inst?.bet_status}, instId=${inst?.lesson_inst_id}, examId=${inst?.exam_id}`);
    });
  } else {
    console.log(await res.text());
  }
}

await inspectUnit941832();
