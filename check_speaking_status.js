import "dotenv/config";
import fs from "fs";

const LOG_PATH = "C:\\Users\\HP\\OneDrive\\Desktop\\betplatform\\speaking_check_log.txt";

function log(msg) {
  const str = typeof msg === "object" ? JSON.stringify(msg, null, 2) : String(msg);
  fs.appendFileSync(LOG_PATH, str + "\n");
  console.log(str);
}

fs.writeFileSync(LOG_PATH, "CHECKING SPEAKING TRACK STATUS...\n");

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

async function check() {
  const token = await login();
  const headers = { Authorization: token };
  const sections = [177430, 177435, 177438, 177443];
  const units = [941831, 941832, 941829, 941830, 941833, 941834, 941849, 941850, 941847, 941848];

  for (const s of sections) {
    log(`\n========================================\n=== SECTION ${s} ===\n========================================`);
    for (const u of units) {
      const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${s}/bet-section-unit-insts/${u}/bet-section-unit-lesson-insts`;
      try {
        const res = await fetch(url, { headers });
        if (!res.ok) continue;
        const list = await res.json();
        if (!Array.isArray(list) || list.length === 0) continue;

        log(`\n--- Unit ${u} (${list.length} lessons) ---`);
        let comp = 0;
        list.forEach(l => {
          const inst = (l.section_unit_lesson_insts || [])[0];
          const status = inst?.bet_status || l.lesson_status;
          const pct = inst?.percentage;
          if (status === "COMPLETED" || status === "PASSED" || (pct != null && pct >= 70)) comp++;
          log(` - L${l.seq_no} "${l.lesson_name}": status=${status} pct=${pct} instId=${inst?.lesson_inst_id}`);
        });
        log(`Total Completed/Passed in Unit ${u}: ${comp} / ${list.length}`);
      } catch (e) {
        log(`Error checking unit ${u}: ${e.message}`);
      }
    }
  }
}

check().then(() => log("FINISHED CHECKING")).catch(e => log("ERROR IN CHECK: " + e.stack));
