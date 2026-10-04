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

async function run() {
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
  const token = (loginData.jwtToken || loginData.token || loginData.id_token).startsWith("Bearer ")
    ? (loginData.jwtToken || loginData.token || loginData.id_token)
    : `Bearer ${loginData.jwtToken || loginData.token || loginData.id_token}`;

  const headers = { Authorization: token };

  // Fetch student sections
  const secRes = await fetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts`, { headers });
  const sections = await secRes.json();
  
  let out = `=== STUDENT ${CONFIG.userId} SECTIONS ===\n`;
  for (const s of sections) {
    out += `Section ID: ${s.bet_section_inst_id} | Name: ${s.section_name} | Track: ${s.track_name || s.section_type}\n`;
    
    // Fetch units in section
    const uRes = await fetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${s.bet_section_inst_id}/bet-section-unit-insts`, { headers });
    if (!uRes.ok) continue;
    const units = await uRes.json();
    for (const u of units) {
      out += `  Unit ID: ${u.bet_unit_inst_id || u.unit_id} | Name: ${u.unit_name} | Status: ${u.unit_status}\n`;
      
      const lRes = await fetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${s.bet_section_inst_id}/bet-section-unit-insts/${u.bet_unit_inst_id || u.unit_id}/bet-section-unit-lesson-insts`, { headers });
      if (!lRes.ok) continue;
      const lessons = await lRes.json();
      let comp = 0;
      lessons.forEach((l) => {
        const inst = (l.section_unit_lesson_insts || [])[0];
        const st = inst?.bet_status || l.lesson_status;
        const pct = inst?.percentage;
        if (st === "COMPLETED" || st === "PASSED" || (pct != null && pct >= 70)) comp++;
        out += `    L${l.seq_no} "${l.lesson_name}": status=${st}, pct=${pct}%\n`;
      });
      out += `  --> Unit Total: ${comp} / ${lessons.length} Completed\n`;
    }
  }

  fs.writeFileSync("speaking_full_inspection.txt", out, "utf8");
  console.log("Inspection complete. Saved to speaking_full_inspection.txt");
}

run().catch((e) => console.error("Error:", e));
