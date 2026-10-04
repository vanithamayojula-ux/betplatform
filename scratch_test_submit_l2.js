import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12505612",
  authToken: process.env.TOKEN,
};

const headers = {
  "Content-Type": "application/json",
  Authorization: CONFIG.authToken,
};

async function test() {
  const examId = "673397400";
  const lessonInstId = "6805509";
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams/${examId}:submit`;
  console.log(`Submitting ${url}...`);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    console.log("Status:", res.status);
    const txt = await res.text();
    console.log("Response:", txt);
  } catch (e) {
    console.error("Error:", e);
  }
}

test();
