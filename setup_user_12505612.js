import "dotenv/config";
import fs from "fs";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const credentials = {
  username: "12505612@lpu.in",
  password: "12505612",
  appContext: "BET_CORPORATE",
};

async function setup() {
  console.log("Logging in as:", credentials.username);
  const loginRes = await fetch("https://corporate.bharatenglish.org/api/public/bet-exams/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });

  const authData = await loginRes.json();
  const rawToken = authData.jwtToken || authData.token || authData.accessToken;
  console.log("Login Status:", loginRes.status);
  console.log("Auth token found:", Boolean(rawToken));

  if (!rawToken) {
    console.error("Login failed:", authData);
    return;
  }

  const bearerToken = rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`;

  // Update .env
  let envContent = "";
  if (fs.existsSync(".env")) {
    envContent = fs.readFileSync(".env", "utf8");
  }
  if (envContent.includes("TOKEN=")) {
    envContent = envContent.replace(/TOKEN=Bearer\s+[^\r\n]+|TOKEN=[^\r\n]+/, `TOKEN=${bearerToken}`);
  } else {
    envContent = `TOKEN=${bearerToken}\n` + envContent;
  }
  fs.writeFileSync(".env", envContent, "utf8");
  console.log("Updated .env with new token!");

  // Decode JWT to get user details
  const payload = JSON.parse(Buffer.from(rawToken.replace("Bearer ", "").split(".")[1], "base64").toString());
  console.log("JWT Payload:", {
    sub: payload.sub,
    email: payload.email,
    firstName: payload.firstName,
    organization: payload.organization,
  });

  const userId = payload.sub || "12505612";
  const orgSlug = payload.organization || "lpu724598";

  // Check user sections and units
  console.log("\nSearching user courses / sections / units...");
  const candidateSections = [
    177434, 177430, 177435, 177438, 177443, 177432, 177436, 177437, 177439, 177440, 177441, 177442, 177444, 177445
  ];
  const candidateUnits = [
    941823, 941828, 941835, 941840, 941824, 941825, 941826, 941827,
    941836, 941837, 941838, 941839, 941841, 941844, 941831, 941832, 941849, 941850
  ];

  let foundSections = new Set();
  for (const sId of candidateSections) {
    for (const uId of candidateUnits) {
      const uUrl = `https://corporate.bharatenglish.org/api/orgs/${orgSlug}/users/${userId}/bet-section-insts/${sId}/bet-section-unit-insts/${uId}/bet-section-unit-lesson-insts`;
      try {
        const uRes = await fetch(uUrl, { headers: { Authorization: bearerToken } });
        if (uRes.ok) {
          const uData = await uRes.json();
          if (Array.isArray(uData) && uData.length > 0) {
            foundSections.add(sId);
            console.log(`\n[MATCH FOUND] Section ${sId} Unit ${uId} has ${uData.length} lessons:`);
            uData.forEach(l => {
              const inst = (l.section_unit_lesson_insts || [])[0];
              console.log(`   - L${l.seq_no} "${l.lesson_name}" status=${l.lesson_status} bet=${inst?.bet_status} pct=${inst?.percentage} instId=${inst?.lesson_inst_id}`);
            });
          }
        }
      } catch {}
    }
  }

  console.log("\nFound Sections:", Array.from(foundSections));
}

setup().catch(console.error);
