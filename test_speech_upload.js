import "dotenv/config";
import https from "https";
import { URL } from "url";

const baseUrl = "https://corporate.bharatenglish.org";
const orgSlug = "lpu724598";
const userId = "12520776";
const headers = {
  "Content-Type": "application/json",
  Authorization: process.env.TOKEN,
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function generateWavBuffer() {
  const sampleRate = 16000;
  const numSamples = sampleRate * 2;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + numSamples * 2, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(numSamples * 2, 40);
  return Buffer.concat([header, Buffer.alloc(numSamples * 2)]);
}

async function uploadToS3(urlStr, buffer) {
  return new Promise((resolve) => {
    const u = new URL(urlStr);
    const req = https.request(
      u,
      { method: "PUT", headers: { "Content-Length": buffer.length } },
      (res) => resolve(res.statusCode)
    );
    req.on("error", (e) => resolve(500));
    req.write(buffer);
    req.end();
  });
}

async function testUpload() {
  const reserveUrl = `${baseUrl}/api/orgs/${orgSlug}/users/${userId}/speech-question:upload`;
  const res = await fetch(reserveUrl, { method: "POST", headers, body: JSON.stringify({}) });
  const slot = await res.json();
  console.log("Slot path:", slot.path);
  console.log("Slot url snippet:", slot.url ? slot.url.slice(0, 60) : "none");

  const wavBuf = generateWavBuffer();
  const putStatus = await uploadToS3(slot.url, wavBuf);
  console.log("PUT status to S3:", putStatus);

  const previewUrl = `https://images1.wexledu.com/${slot.path}`;
  console.log("Constructed previewUrl:", previewUrl);
}

testUpload().catch(console.error);
