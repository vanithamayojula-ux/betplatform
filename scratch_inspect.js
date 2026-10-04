import "dotenv/config";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
  const res = await fetch("https://corporate.bharatenglish.org");
  const html = await res.text();
  console.log("HTML length:", html.length);
  const scripts = [...html.matchAll(/src=["']([^"']+\.js)["']/g)].map(m => m[1]);
  console.log("Scripts found:", scripts);
}

main().catch(console.error);
