import "dotenv/config";

const baseUrl = "https://corporate.bharatenglish.org";
const orgSlug = "lpu724598";
const userId = "12520776";
const headers = {
  "Content-Type": "application/json",
  Authorization: process.env.TOKEN,
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
  const units = [
    { secName: "Writing", secId: "176869", uId: 941805 },
    { secName: "Speaking", secId: "176843", uId: 941831 },
    { secName: "Speaking", secId: "176843", uId: 941832 },
  ];

  for (const u of units) {
    const url = `${baseUrl}/api/orgs/${orgSlug}/users/${userId}/bet-section-insts/${u.secId}/bet-section-unit-insts/${u.uId}/bet-section-unit-lesson-insts`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.log(`Fetch failed for ${u.secName} Unit ${u.uId}: ${res.status}`);
      continue;
    }
    const lessons = await res.json();
    console.log(`\n=== ${u.secName} Unit ${u.uId} (${lessons.length} lessons) ===`);
    lessons.forEach((l) => {
      const inst = (l.section_unit_lesson_insts || [])[0];
      console.log(` L${l.seq_no} "${l.lesson_name}": status=${l.lesson_status}, bet=${inst?.bet_status}, pct=${inst?.percentage}, inst_id=${inst?.lesson_inst_id}`);
    });
  }
}

main().catch(console.error);
