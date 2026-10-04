import "dotenv/config";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
  const headers = {
    "Content-Type": "application/json",
    Authorization: process.env.TOKEN,
  };

  for (const user of ["12518334", "12518334@lpu.in"]) {
    for (const s of [177439, 177431, 177434, 177435, 177437]) {
      const url = `https://corporate.bharatenglish.org/api/orgs/lpu724598/users/${user}/bet-section-insts/${s}/bet-section-unit-insts`;
      const r = await fetch(url, { headers });
      console.log(user, s, r.status);
      if (r.ok) {
        console.log(await r.text());
      }
    }
  }
}

main().catch(console.error);
