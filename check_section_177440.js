import "dotenv/config";
import fs from "fs";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12505612",
  authToken: process.env.TOKEN,
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const units = [941841, 941844, 941842, 941843];

async function check() {
  let output = `Checking Section 177440 for User: ${CONFIG.userId}\n`;
  for (const u of units) {
    const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/177440/bet-section-unit-insts/${u}/bet-section-unit-lesson-insts`;
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
  console.log(output);
  fs.writeFileSync("section_177440_status.txt", output);
}

check();
