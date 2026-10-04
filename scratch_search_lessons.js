import "dotenv/config";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
  const url = "https://corporate.bharatenglish.org/main-EXVCZZ6V.js";
  const res = await fetch(url);
  const bundle = await res.text();

  const terms = ["assign-lesson", "level-test", "bet-section-unit-lesson-insts", "bet-section-unit-lessons"];
  for (const term of terms) {
    let idx = 0;
    console.log(`\n================ ${term} ================`);
    while ((idx = bundle.indexOf(term, idx)) !== -1) {
      console.log("--- Occurrence at", idx, "---");
      console.log(bundle.slice(Math.max(0, idx - 150), Math.min(bundle.length, idx + 250)));
      idx += term.length;
    }
  }
}

main().catch(console.error);
