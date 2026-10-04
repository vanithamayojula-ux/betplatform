import fs from 'fs';

const token = fs.readFileSync('.env', 'utf8').match(/TOKEN=(.*)/)[1].trim();

async function testCreateExam() {
  const lessonInstId = 5595243;
  const url = `https://corporate.bharatenglish.org/api/orgs/lpu724598/users/12520776/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams`;
  
  console.log(`POSTing to ${url}...`);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": token
    },
    body: "{}"
  });

  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Body:", text);
}

testCreateExam();
