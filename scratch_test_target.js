import "dotenv/config";

async function test() {
  const url = `https://corporate.bharatenglish.org/api/orgs/lpu724598/users/12505612/bet-section-insts/177434/bet-section-unit-insts/941828/bet-section-unit-lesson-insts`;
  const res = await fetch(url, { headers: { Authorization: process.env.TOKEN } });
  const list = await res.json();
  console.log("Lessons count:", list.length);
  list.forEach(l => {
    const inst = (l.section_unit_lesson_insts || [])[0];
    const isCompleted = inst?.bet_status === "COMPLETED" || inst?.bet_status === "PASSED";
    const isLocked = l.lesson_status === "LOCKED" || inst?.bet_status === "LOCKED";
    const isPending = !isCompleted && !isLocked;
    console.log(`L${l.seq_no} "${l.lesson_name}": lesson_status=${l.lesson_status}, inst_bet=${inst?.bet_status}, isPending=${isPending}`);
  });
}

test();
