import "dotenv/config";

const baseUrl = "https://corporate.bharatenglish.org";
const orgSlug = "lpu724598";
const userId = "12520776";
const headers = {
  "Content-Type": "application/json",
  Authorization: process.env.TOKEN,
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const TRACKS = [
  {
    name: "Listening 🎧",
    sectionInstId: "176874",
    units: [
      { id: 941823, name: "Starting the Day Instructions" },
      { id: 941828, name: "First Day at Work" },
      { id: 941824, name: "Identifying Office Furniture" },
      { id: 941825, name: "Morning Routine Overview" },
      { id: 941826, name: "Print Room Confusion" },
      { id: 941827, name: "Level Test" },
    ],
  },
  {
    name: "Speaking 🗣️",
    sectionInstId: "176843",
    units: [
      { id: 941832, name: "Professional Greetings" },
      { id: 941831, name: "Self Introductions" },
      { id: 941829, name: "Describing Work Routine" },
      { id: 941830, name: "Expressing Opinions" },
      { id: 941833, name: "Asking Questions" },
      { id: 941834, name: "Level Test" },
    ],
  },
  {
    name: "Writing ✍️",
    sectionInstId: "176869",
    units: [
      { id: 941805, name: "Write a Job Title" },
      { id: 941820, name: "Email Greeting Exploration" },
      { id: 941821, name: "Complete Safety Instruction" },
      { id: 941822, name: "Level Test" },
    ],
  },
  {
    name: "Reading 📖",
    sectionInstId: "176800",
    units: [
      { id: 941841, name: "Emails and Messages" },
      { id: 941844, name: "Office Notices" },
      { id: 941842, name: "Short Articles" },
      { id: 941843, name: "Reports and Summaries" },
      { id: 941845, name: "Workplace Guidelines" },
      { id: 941846, name: "Level Test" },
    ],
  },
];

async function main() {
  let grandTotalLessons = 0;
  let grandTotalDone = 0;

  const trackResults = await Promise.all(
    TRACKS.map(async (track) => {
      const unitResults = await Promise.all(
        track.units.map(async (u) => {
          const url = `${baseUrl}/api/orgs/${orgSlug}/users/${userId}/bet-section-insts/${track.sectionInstId}/bet-section-unit-insts/${u.id}/bet-section-unit-lesson-insts`;
          try {
            const res = await fetch(url, { headers });
            if (!res.ok) return { ...u, numLessons: 0, numDone: 0 };
            const lessons = await res.json();
            const numLessons = lessons.length;
            const doneList = lessons.filter((l) => {
              const inst = (l.section_unit_lesson_insts || [])[0];
              return (
                l.lesson_status === "COMPLETED" ||
                inst?.bet_status === "COMPLETED" ||
                inst?.bet_status === "PASSED" ||
                inst?.bet_status === "PENDING_EVALUATION" ||
                (inst?.percentage !== null && inst?.percentage !== undefined)
              );
            });
            return { ...u, numLessons, numDone: doneList.length };
          } catch {
            return { ...u, numLessons: 0, numDone: 0 };
          }
        })
      );
      const totalL = unitResults.reduce((a, b) => a + b.numLessons, 0);
      const totalD = unitResults.reduce((a, b) => a + b.numDone, 0);
      return { trackName: track.name, units: unitResults, totalL, totalD };
    })
  );

  console.log(`\n======================================================`);
  console.log(`📊 LIVE COURSE PROGRESS REPORT FOR USER 12520776`);
  console.log(`======================================================\n`);

  for (const tr of trackResults) {
    console.log(`--- ${tr.trackName} ---`);
    for (const u of tr.units) {
      const pct = u.numLessons > 0 ? `${Math.round((u.numDone / u.numLessons) * 100)}%` : "0%";
      console.log(`  Unit ${u.id} (${u.name}): ${u.numDone}/${u.numLessons} (${pct})`);
    }
    grandTotalLessons += tr.totalL;
    grandTotalDone += tr.totalD;
    const tPct = tr.totalL > 0 ? `${((tr.totalD / tr.totalL) * 100).toFixed(1)}%` : "0%";
    console.log(`  >> TRACK TOTAL: ${tr.totalD}/${tr.totalL} (${tPct})\n`);
  }

  const grandPct = grandTotalLessons > 0 ? `${((grandTotalDone / grandTotalLessons) * 100).toFixed(1)}%` : "0%";
  console.log(`======================================================`);
  console.log(`🎉 OVERALL COURSE TOTAL: ${grandTotalDone}/${grandTotalLessons} lessons (${grandPct})`);
  console.log(`======================================================\n`);
}

main().catch(console.error);
