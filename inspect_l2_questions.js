import "dotenv/config";
import fs from "fs";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12505612",
  authToken: process.env.TOKEN,
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function run() {
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/673964200/questions`;
  const res = await fetch(url, { headers: { Authorization: CONFIG.authToken } });
  if (res.ok) {
    const data = await res.json();
    const questions = (data.test_definition_section || []).flatMap((s) => s.questions || []);
    console.log(JSON.stringify(questions, null, 2));
    fs.writeFileSync("l2_questions.json", JSON.stringify(questions, null, 2));
  }
}

run();
