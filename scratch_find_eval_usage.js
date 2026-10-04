import "dotenv/config";
import fs from "fs";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
  const url = "https://corporate.bharatenglish.org/main-EXVCZZ6V.js";
  const res = await fetch(url);
  const bundle = await res.text();

  let idx = 0;
  while ((idx = bundle.indexOf("getWritingEvaluation", idx)) !== -1) {
    console.log("=== Found getWritingEvaluation at", idx, "===");
    console.log(bundle.slice(Math.max(0, idx - 500), Math.min(bundle.length, idx + 1000)));
    idx += "getWritingEvaluation".length;
  }
}

main().catch(console.error);
