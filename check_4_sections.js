import "dotenv/config";

const baseUrl = "https://corporate.bharatenglish.org";
const orgSlug = "lpu724598";
const userId = "12520776";
const headers = {
  "Content-Type": "application/json",
  Authorization: process.env.TOKEN,
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SECTIONS = [
  { name: "Listening", id: "176874" },
  { name: "Speaking", id: "176843" },
  { name: "Writing", id: "176869" },
  { name: "Reading", id: "176800" },
];

async function main() {
  for (const s of SECTIONS) {
    console.log(`\n==================================================`);
    console.log(`TRACK: ${s.name} (Section Inst ID: ${s.id})`);
    console.log(`==================================================`);

    const uUrl = `${baseUrl}/api/orgs/${orgSlug}/users/${userId}/bet-section-insts/${s.id}/bet-section-unit-insts`;
    const uRes = await fetch(uUrl, { headers });
    if (!uRes.ok) {
      console.error(` Failed to fetch units for section ${s.id}: ${uRes.status}`);
      continue;
    }
    const units = await uRes.json();
    for (const u of units) {
      const uId = u.section_unit_inst_id || u.id;
      const lUrl = `${baseUrl}/api/orgs/${orgSlug}/users/${userId}/bet-section-insts/${s.id}/bet-section-unit-insts/${uId}/bet-section-unit-lesson-insts`;
      const lRes = await fetch(lUrl, { headers });
      let lessonInfo = "N/A";
      if (lRes.ok) {
        const lessons = await lRes.json();
        const completed = lessons.filter(l => {
          const inst = (l.section_unit_lesson_insts || [])[0];
          return l.lesson_status === "COMPLETED" || inst?.bet_status === "COMPLETED" || inst?.bet_status === "PASSED" || inst?.bet_status === "PENDING_EVALUATION" || inst?.percentage !== null;
        }).length;
        lessonInfo = `${completed}/${lessons.length} completed/submitted`;
      }
      console.log(`  Unit ${uId}: ${u.unit_name || u.name} | Status: ${u.unit_status || u.status} | Pct: ${u.percentage}% | Lessons: ${lessonInfo}`);
    }
  }
}

main().catch(console.error);
