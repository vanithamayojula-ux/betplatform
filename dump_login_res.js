import fs from 'fs';

async function dumpLogin() {
  const res = await fetch('https://corporate.bharatenglish.org/api/public/bet-exams/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: "12519446@lpu.in",
      password: "12519446",
      appContext: 'BET_CORPORATE'
    })
  });

  const data = await res.json();
  fs.writeFileSync('login_res_12519446.json', JSON.stringify(data, null, 2));
}

dumpLogin();
