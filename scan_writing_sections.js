import "dotenv/config";
import fs from "fs";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12505612",
  authToken: process.env.TOKEN,
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const knownUnits = [
  941820, 941805, 941841, 941844, 941842, 941843, 941845, 941846,
  941821, 941822, 941823, 941824, 941825, 941826, 941827, 941828,
  941829, 941830, 941831, 941832, 941833, 941834, 941835, 941836,
  941837, 941838, 941839, 941840, 941847, 941848, 941849, 941850
];

const candidateSections = [
  177428, 177429, 177430, 177431, 177432, 177433, 177434, 177435, 177436, 177437, 177438, 177439, 177440, 177441, 177442, 177443, 177444, 177445
];

async function scan() {
  const matches = [];
  console.log("Scanning candidate sections & units...");
  for (const sId of candidateSections) {
    for (const uId of knownUnits) {
      const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${sId}/bet-section-unit-insts/${uId}/bet-section-unit-lesson-insts`;
      try {
        const res = await fetch(url, { headers: { Authorization: CONFIG.authToken } });
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            console.log(`FOUND MATCH! Section ${sId} Unit ${uId}: ${list.length} lessons ("${list[0]?.lesson_name}")`);
            matches.push({ sectionId: sId, unitId: uId, count: list.length, sampleLesson: list[0]?.lesson_name });
          }
        }
      } catch (e) {}
    }
  }
  fs.writeFileSync("writing_scan_matches.json", JSON.stringify(matches, null, 2));
  console.log(`Scan complete. Found ${matches.length} matching section-unit pairs.`);
}

scan();
