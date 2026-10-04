import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

export function generateLocalTTS(text) {
  const tmpWav = path.join(os.tmpdir(), `tts_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`);
  const safeText = text.replace(/["'`$]/g, " ").replace(/\s+/g, " ").trim();
  const psCmd = `powershell.exe -Command "Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate = 0; $s.Volume = 100; $s.SetOutputToWaveFile('${tmpWav.replace(/\\/g, "\\\\")}'); $s.Speak('${safeText}'); $s.Dispose();"`;
  
  execSync(psCmd, { stdio: "ignore" });
  if (fs.existsSync(tmpWav)) {
    const buffer = fs.readFileSync(tmpWav);
    try { fs.unlinkSync(tmpWav); } catch {}
    console.log(` -> Local TTS generated ${buffer.length} bytes for: "${safeText.slice(0, 60)}..."`);
    return buffer;
  }
  throw new Error("Failed to generate local TTS WAV");
}

const buf = generateLocalTTS("Today, I will do many tasks without using any technology at all.");
console.log("Success! Buffer size:", buf.length);
