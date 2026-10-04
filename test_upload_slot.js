import "dotenv/config";

async function test() {
  const reserveUrl = `https://corporate.bharatenglish.org/api/orgs/lpu724598/users/12509952@lpu.in/speech-question:upload`;
  const res = await fetch(reserveUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: process.env.TOKEN,
    },
    body: JSON.stringify({}),
  });
  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Data:", data);
}

test();
