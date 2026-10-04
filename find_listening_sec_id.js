import fs from 'fs';

const token = fs.readFileSync('.env', 'utf8').match(/TOKEN=(.*)/)[1].trim();

async function findListeningSectionId() {
  console.log("Searching for student 12519446 Listening betSectionInstId...");
  const unitId = 941823;

  const batchSize = 100;
  for (let start = 177000; start < 178500; start += batchSize) {
    const promises = [];
    for (let secId = start; secId < start + batchSize; secId++) {
      const url = `https://corporate.bharatenglish.org/api/orgs/lpu724598/users/12519446/bet-section-insts/${secId}/bet-section-unit-insts/${unitId}/bet-section-unit-lesson-insts`;
      promises.push(
        fetch(url, { headers: { authorization: token } }).then(async r => {
          if (r.ok) {
            const data = await r.json();
            if (Array.isArray(data) && data.length > 0) {
              console.log(`FOUND LISTENING SECTION INST ID: ${secId}! Lessons: ${data.length}`);
              fs.writeFileSync('listening_sec_id.txt', String(secId));
              return secId;
            }
          }
        }).catch(() => {})
      );
    }
    await Promise.all(promises);
    if (fs.existsSync('listening_sec_id.txt')) break;
  }
}

findListeningSectionId();
