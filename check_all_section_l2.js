import "dotenv/config";
import fs from "fs";

function log(msg) {
  const str = typeof msg === "object" ? JSON.stringify(msg, null, 2) : String(msg);
  fs.appendFileSync("l2_log.txt", str + "\n");
  console.log(str);
}

fs.writeFileSync("l2_log.txt", "CHECKING UNIT 941821 ACROSS ALL SECTIONS...\n");

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

async function checkAll() {
  const token = await login();
  const headers = { Authorization: token };
  const sections = [177431, 177433, 177439, 177441, 177445];

  for (const s of sections) {
    const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${s}/bet-section-unit-insts/941821/bet-section-unit-lesson-insts`;
    try {
      const res = await fetch(url, { headers });
      if (res.ok) {
        const list = await res.json();
        log(`=== SECTION ${s} ===`);
        list.forEach(l => {
          const inst = (l.section_unit_lesson_insts || [])[0];
          log(`L${l.seq_no} "${l.lesson_name}": lesson_status=${l.lesson_status} bet_status=${inst?.bet_status} instId=${inst?.lesson_inst_id}`);
        });
      }
    } catch (e) {
      log(`Error in section ${s}: ${e.message}`);
    }
  }
}

checkAll();
