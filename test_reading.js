import fs from 'fs';

const token = fs.readFileSync('.env', 'utf8').match(/TOKEN=(.*)/)[1].trim();

async function run() {
  const url = `https://corporate.bharatenglish.org/api/orgs/lpu724598/users/12520776/bet-section-insts/176827/bet-section-unit-insts/941801/bet-section-unit-lesson-insts`;
  const res = await fetch(url, { headers: { authorization: token } });
  console.log("Status:", res.status);
  if (res.ok) {
    const data = await res.json();
    console.log("Lessons count:", data.length);
    console.log(JSON.stringify(data.slice(0, 2), null, 2));
  }
}

run();
