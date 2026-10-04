import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12505612",
  authToken: process.env.TOKEN,
  betSectionInstId: "177434",
};

const units = [941823, 941828, 941835, 941840, 941824, 941825, 941826, 941827];
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import fs from "fs";

async function check() {
  let output = `Checking Listening Status for User: ${CONFIG.userId}\n`;
  for (const u of units) {
    const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.betSectionInstId}/bet-section-unit-insts/${u}/bet-section-unit-lesson-insts`;
    try {
      const res = await fetch(url, { headers: { Authorization: CONFIG.authToken } });
      if (!res.ok) continue;
      const list = await res.json();
      output += `\n=== Unit ${u} (${list.length} lessons) ===\n`;
      let comp = 0;
      list.forEach(l => {
        const inst = (l.section_unit_lesson_insts || [])[0];
        const status = inst?.bet_status || l.lesson_status;
        const pct = inst?.percentage;
        if (status === "COMPLETED" || status === "PASSED") comp++;
        output += ` - L${l.seq_no} "${l.lesson_name}": status=${status} pct=${pct} instId=${inst?.lesson_inst_id}\n`;
      });
      output += `Total Completed in Unit ${u}: ${comp} / ${list.length}\n`;
    } catch (e) {
      output += `Error checking unit ${u}: ${e.message}\n`;
    }
  }
  fs.writeFileSync("check_status_output.txt", output);
  console.log(output);
}

check();
