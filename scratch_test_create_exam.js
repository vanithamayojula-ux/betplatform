import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12509952",
  authToken: process.env.TOKEN,
};

const headers = {
  "Content-Type": "application/json",
  Authorization: CONFIG.authToken,
};

async function test() {
  const lessonInstId = 7822177;
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams`;
  console.log(`Calling POST ${url}...`);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    console.log("Status:", res.status);
    const txt = await res.text();
    console.log("Body:", txt);
  } catch (e) {
    console.error("Fetch error:", e);
  }
}

test();
