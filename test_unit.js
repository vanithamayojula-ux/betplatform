import fs from 'fs';

const dotenv = fs.readFileSync('.env', 'utf8');
const tokenMatch = dotenv.match(/TOKEN=(.*)/);
const token = tokenMatch ? tokenMatch[1].trim() : '';

async function run() {
  const r = await fetch('https://corporate.bharatenglish.org/api/orgs/lpu724598/users/12505612/bet-exams/678614400/questions', {
    headers: { authorization: token }
  });
  const data = await r.json();
  fs.writeFileSync('q_spch_dump.json', JSON.stringify(data, null, 2));
}

run();
