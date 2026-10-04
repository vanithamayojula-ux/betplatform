import fs from 'fs';

const token = fs.readFileSync('.env', 'utf8').match(/TOKEN=(.*)/)[1].trim();

async function findReadingUnits() {
  const possibleUnits = [941801, 941802, 941803, 941804, 941819, 941841, 941844, 941842, 941843, 941845, 941846];
  const validUnits = [];

  for (const uid of possibleUnits) {
    const url = `https://corporate.bharatenglish.org/api/orgs/lpu724598/users/12520776/bet-section-insts/176827/bet-section-unit-insts/${uid}/bet-section-unit-lesson-insts`;
    try {
      const r = await fetch(url, { headers: { authorization: token } });
      if (r.ok) {
        const d = await r.json();
        if (Array.isArray(d) && d.length > 0) {
          console.log(`VALID READING UNIT: ${uid}, Lessons: ${d.length}`);
          validUnits.push(uid);
        }
      }
    } catch {}
  }

  fs.writeFileSync('valid_reading_units.json', JSON.stringify(validUnits, null, 2));
}

findReadingUnits();
