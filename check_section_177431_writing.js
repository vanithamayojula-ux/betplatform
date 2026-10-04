import "dotenv/config";
import fs from "fs";

function log(msg) {
  const str = typeof msg === "object" ? JSON.stringify(msg, null, 2) : String(msg);
  fs.appendFileSync("sec_31_log.txt", str + "\n");
  console.log(str);
}

fs.writeFileSync("sec_31_log.txt", "CHECKING SECTION 177431...\n");

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

async function checkSec31() {
  const token = await login();
  const headers = { Authorization: token };
  const s = 177431;
  const units = [941805, 941820, 941821, 941822];

  for (const u of units) {
    const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${s}/bet-section-unit-insts/${u}/bet-section-unit-lesson-insts`;
    try {
      const res = await fetch(url, { headers });
      if (res.ok) {
        const list = await res.json();
        log(`=== SECTION ${s} UNIT ${u} (${list.length} lessons) ===`);
        list.forEach(l => {
          const inst = (l.section_unit_lesson_insts || [])[0];
          log(`L${l.seq_no} "${l.lesson_name}": lesson_status=${l.lesson_status} bet_status=${inst?.bet_status} pct=${inst?.percentage} instId=${inst?.lesson_inst_id}`);
        });
      }
    } catch (e) {
      log(`Error: ${e.message}`);
    }
  }
}

checkSec31();
