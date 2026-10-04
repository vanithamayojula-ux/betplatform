import "dotenv/config";
import fs from "fs";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
  const url = "https://corporate.bharatenglish.org/main-EXVCZZ6V.js";
  console.log("Fetching bundle...");
  const res = await fetch(url);
  const bundle = await res.text();
  console.log("Bundle size:", bundle.length);

  // Search patterns
  const patterns = [
    /bet-exams[a-zA-Z0-9_\-/:{}]+/g,
    /subjective_written_answer/g,
    /marks_secured/g,
    /ai_marks/g,
    /rich_analysis/g,
    /:submit/g
  ];

  for (const p of patterns) {
    const matches = [...bundle.matchAll(p)].map(m => m[0]);
    console.log(`Pattern ${p}:`, [...new Set(matches)]);
  }

  // Find occurrences around bet-exams
  let idx = 0;
  while ((idx = bundle.indexOf("bet-exams", idx)) !== -1) {
    console.log("--- Snippet around bet-exams ---");
    console.log(bundle.slice(Math.max(0, idx - 100), Math.min(bundle.length, idx + 200)));
    idx += "bet-exams".length;
  }
}

main().catch(console.error);
