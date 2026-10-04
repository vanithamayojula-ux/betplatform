import "dotenv/config";

const baseUrl = "https://corporate.bharatenglish.org";
const orgSlug = "lpu724598";
const userId = "12520776";
const headers = {
  "Content-Type": "application/json",
  Authorization: process.env.TOKEN,
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const endpoints = [
  `/api/orgs/${orgSlug}/users/${userId}/bet-sections`,
  `/api/orgs/${orgSlug}/users/${userId}/bet-dashboard`,
  `/api/orgs/${orgSlug}/users/${userId}/bet-user-courses`,
  `/api/orgs/${orgSlug}/users/${userId}/bet-user-section-insts`,
  `/api/orgs/${orgSlug}/users/${userId}/bet-user-dashboard`,
  `/api/orgs/${orgSlug}/users/${userId}/dashboard`,
  `/api/orgs/${orgSlug}/users/${userId}/courses`,
  `/api/orgs/${orgSlug}/users/${userId}/enrolled-courses`,
  `/api/orgs/${orgSlug}/users/${userId}/bet-course-insts`,
  `/api/public/bet-exams/dashboard`,
];

async function probe() {
  for (const ep of endpoints) {
    const url = `${baseUrl}${ep}`;
    try {
      const res = await fetch(url, { headers });
      console.log(`[${res.status}] ${ep}`);
      if (res.ok) {
        const text = await res.text();
        console.log(`  -> Response snippet: ${text.slice(0, 200)}\n`);
      }
    } catch (e) {
      console.log(`[ERR] ${ep}: ${e.message}`);
    }
  }
}

probe().catch(console.error);
