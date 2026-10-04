import "dotenv/config";

async function test() {
  const lessonInstId = "6805526";
  const url = `https://corporate.bharatenglish.org/api/orgs/lpu724598/users/12505612/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams`;
  console.log(`Calling POST ${url}...`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: process.env.TOKEN },
    body: JSON.stringify({}),
  });
  console.log("Status:", res.status);
  const txt = await res.text();
  console.log("Body:", txt);
}

test();
