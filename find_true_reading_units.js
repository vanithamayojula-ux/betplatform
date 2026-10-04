import fs from 'fs';

const token = fs.readFileSync('.env', 'utf8').match(/TOKEN=(.*)/)[1].trim();

async function findReadingUnits() {
  console.log("Inspecting all units for Section 176827 (Reading)...");

  // Scan unit IDs 941800 to 941860
  const validReading = [];

  for (let u = 941800; u <= 941860; u++) {
    const url = `https://corporate.bharatenglish.org/api/orgs/lpu724598/users/12520776/bet-section-insts/176827/bet-section-unit-insts/${u}/bet-section-unit-lesson-insts`;
    try {
      const r = await fetch(url, { headers: { authorization: token } });
      if (r.ok) {
        const data = await r.json();
        if (Array.isArray(data) && data.length > 0) {
          const sampleQuestion = data[0];
          const unitName = sampleQuestion.lesson_name || sampleQuestion.unit_name || "";
          const sectionName = sampleQuestion.section_name || "";
          console.log(`Unit ${u}: Section="${sectionName}", Sample="${unitName}"`);
          if (sectionName.toLowerCase().includes("read")) {
            validReading.push({ u, unitName, sectionName });
          }
        }
      }
    } catch {}
  }

  console.log("\n--- TRUE READING UNITS ---");
  console.log(JSON.stringify(validReading, null, 2));
  fs.writeFileSync('true_reading_units.json', JSON.stringify(validReading, null, 2));
}

findReadingUnits();
