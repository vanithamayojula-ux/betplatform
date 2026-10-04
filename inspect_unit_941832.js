import "dotenv/config";

async function run() {
  const url = `https://corporate.bharatenglish.org/api/orgs/lpu724598/users/12509952/bet-section-insts/177430/bet-section-unit-insts/941832/bet-section-unit-lesson-insts`;
  const res = await fetch(url, { headers: { Authorization: process.env.TOKEN } });
  const list = await res.json();
  console.log(JSON.stringify(list.map(l => ({
    seq_no: l.seq_no,
    lesson_id: l.lesson_id,
    lesson_name: l.lesson_name,
    lesson_status: l.lesson_status,
    inst_count: (l.section_unit_lesson_insts || []).length,
    inst: (l.section_unit_lesson_insts || [])[0],
  })), null, 2));
}

run();
