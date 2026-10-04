import "dotenv/config";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
  const headers = {
    "Content-Type": "application/json",
    Authorization: process.env.TOKEN,
  };
  const examId = 666851500;
  const qUuid = "365d725e-e1d2-43a7-8500-4a18b546ce83";
  const url = `https://corporate.bharatenglish.org/api/orgs/lpu724598/bet-exams/${examId}/writing-evaluation?question_uuid=${qUuid}`;

  console.log("Calling writing-evaluation:", url);
  for (let i = 1; i <= 5; i++) {
    const res = await fetch(url, { method: "POST", headers, body: "{}" });
    console.log(`Attempt ${i} Status:`, res.status);
    const text = await res.text();
    console.log("Body:", text);
    if (res.status === 200) break;
    await new Promise((r) => setTimeout(r, 3000));
  }
}

main().catch(console.error);
