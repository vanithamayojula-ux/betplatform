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
  const tmpPs1 = path.join(os.tmpdir(), `tts_script_${Date.now()}.ps1`);
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
    console.log(` -> Local TTS generated ${buffer.length} bytes for: "${text.slice(0, 60)}..."`);
    return buffer;
  }
  throw new Error("Failed to generate local TTS WAV");
}

const buf = generateLocalTTS("Today, I'll spend a day without technology! What's the plan? Let's read, talk, and walk.");
console.log("Success! Buffer size:", buf.length);
