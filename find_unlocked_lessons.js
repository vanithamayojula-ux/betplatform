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
  { name: "Listening 🎧", sectionInstId: "176874", units: [941823, 941828, 941824, 941825, 941826, 941827] },
  { name: "Speaking 🗣️", sectionInstId: "176843", units: [941832, 941831, 941829, 941830, 941833, 941834] },
  { name: "Writing ✍️", sectionInstId: "176869", units: [941805, 941820, 941821, 941822] },
  { name: "Reading 📖", sectionInstId: "176800", units: [941841, 941844, 941842, 941843, 941845, 941846] },
];

async function main() {
  console.log(`=== UNLOCKED / IN-PROGRESS LESSONS SEARCH ===\n`);
  for (const s of SECTIONS) {
    console.log(`\n--- TRACK: ${s.name} ---`);
    for (const uId of s.units) {
      const url = `${baseUrl}/api/orgs/${orgSlug}/users/${userId}/bet-section-insts/${s.sectionInstId}/bet-section-unit-insts/${uId}/bet-section-unit-lesson-insts`;
      try {
        const res = await fetch(url, { headers });
        if (!res.ok) continue;
        const lessons = await res.json();
        const unlocked = lessons.filter((l) => {
          const inst = (l.section_unit_lesson_insts || [])[0];
          return (
            l.lesson_status === "NOT_STARTED" ||
            l.lesson_status === "IN_PROGRESS" ||
            inst?.bet_status === "NOT_STARTED" ||
            inst?.bet_status === "IN_PROGRESS"
          );
        });
        if (unlocked.length > 0) {
          console.log(`  Unit ${uId}: ${unlocked.length} unlocked lesson(s) found:`);
          unlocked.forEach((l) => {
            const inst = (l.section_unit_lesson_insts || [])[0];
            console.log(`   -> L${l.seq_no} "${l.lesson_name}" (status=${l.lesson_status}, bet=${inst?.bet_status}, pct=${inst?.percentage})`);
          });
        }
      } catch (e) {
        console.error(`  Error in unit ${uId}:`, e.message);
      }
    }
  }
}

main().catch(console.error);
