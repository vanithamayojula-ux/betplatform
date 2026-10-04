import "dotenv/config";
import fs from "fs";

const baseUrl = "https://corporate.bharatenglish.org";
const orgSlug = "lpu724598";
const userId = "12520776";
const headers = {
  "Content-Type": "application/json",
  Authorization: process.env.TOKEN,
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
  const url = `${baseUrl}/api/orgs/${orgSlug}/users/${userId}/bet-section-insts`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    console.error("Fetch section insts failed:", res.status, await res.text());
    return;
  }
  const sections = await res.json();
  console.log(`Found ${sections.length} sections for user ${userId}:`);

  for (const s of sections) {
    console.log(`\n==================================================`);
    console.log(`SECTION: ${s.section_name} (ID: ${s.section_inst_id}) - Status: ${s.section_status}, Pct: ${s.percentage}%`);
    console.log(`==================================================`);

    const uUrl = `${baseUrl}/api/orgs/${orgSlug}/users/${userId}/bet-section-insts/${s.section_inst_id}/bet-section-unit-insts`;
    const uRes = await fetch(uUrl, { headers });
    if (!uRes.ok) {
      console.error(` Failed to fetch units for section ${s.section_inst_id}`);
      continue;
    }
    const units = await uRes.json();
    for (const u of units) {
      console.log(`  UNIT: ${u.unit_name} (ID: ${u.section_unit_inst_id}) - Status: ${u.unit_status}, Pct: ${u.percentage}%`);
    }
  }
}

main().catch(console.error);
