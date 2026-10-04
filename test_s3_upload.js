import "dotenv/config";
import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";

function generateLocalTTS(text) {
  const tmpTxt = path.join(os.tmpdir(), `tts_in_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`);
  const tmpWav = path.join(os.tmpdir(), `tts_out_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`);
  fs.writeFileSync(tmpTxt, text, "utf8");
  
  const psScript = `
Add-Type -AssemblyName System.Speech
$txt = [System.IO.File]::ReadAllText('${tmpTxt.replace(/'/g, "''")}', [System.Text.Encoding]::UTF8)
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.Rate = 0
$s.Volume = 100
$s.SetOutputToWaveFile('${tmpWav.replace(/'/g, "''")}')
$s.Speak($txt)
$s.Dispose()
`;
  const tmpPs1 = path.join(os.tmpdir(), `tts_script_${Date.now()}_${Math.random().toString(36).slice(2)}.ps1`);
  fs.writeFileSync(tmpPs1, psScript, "utf8");
  
  try {
    execSync(`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${tmpPs1}"`, { stdio: "pipe" });
  } finally {
    try { fs.unlinkSync(tmpTxt); } catch {}
    try { fs.unlinkSync(tmpPs1); } catch {}
  }
  
  if (fs.existsSync(tmpWav)) {
    const buffer = fs.readFileSync(tmpWav);
    try { fs.unlinkSync(tmpWav); } catch {}
    return buffer;
  }
  throw new Error("Failed to generate local TTS WAV");
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
  console.log("Slot:", slot);

  const buf = generateLocalTTS("This is a short test sentence for audio speech upload.");
  console.log("Generated WAV bytes:", buf.length);

  console.log("Attempting PUT without headers...");
  const putRes = await fetch(slot.url, {
    method: "PUT",
    body: buf,
  });
  console.log("PUT status:", putRes.status);
  const putText = await putRes.text();
  console.log("PUT body:", putText);

  const headRes = await fetch(slot.previewUrl, { method: "HEAD" });
  console.log("Preview HEAD status:", headRes.status, "content-length:", headRes.headers.get("content-length"));
}

test().catch(console.error);
