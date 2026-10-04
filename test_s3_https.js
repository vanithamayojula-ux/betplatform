import "dotenv/config";
import https from "https";
import { URL } from "url";

function uploadToS3Https(s3Url, buffer) {
  return new Promise((resolve, reject) => {
    const u = new URL(s3Url);
    const req = https.request(
      {
        hostname: u.hostname,
        port: 443,
        path: u.pathname + u.search,
        method: "PUT",
        headers: {
          "Content-Length": buffer.length,
        },
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ok: true, status: res.statusCode, body });
          } else {
            resolve({ ok: false, status: res.statusCode, body });
          }
        });
      }
    );
    req.on("error", reject);
    req.write(buffer);
    req.end();
  });
}

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
  const slot = await res.json();
  console.log("Got slot path:", slot.path);

  const testBuf = Buffer.alloc(500000, 1);
  console.log("Uploading 500KB via https.request...");
  const t0 = Date.now();
  const putRes = await uploadToS3Https(slot.url, testBuf);
  console.log("Upload finished in", Date.now() - t0, "ms, status:", putRes.status);
}

test().catch(console.error);
