import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";

function generateCompactLocalTTS(text) {
  const tmpTxt = path.join(os.tmpdir(), `tts_in_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`);
  const tmpWav = path.join(os.tmpdir(), `tts_out_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`);
  fs.writeFileSync(tmpTxt, text, "utf8");
  
  const psScript = `
Add-Type -AssemblyName System.Speech
$txt = [System.IO.File]::ReadAllText('${tmpTxt.replace(/'/g, "''")}', [System.Text.Encoding]::UTF8)
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.Rate = 1
$s.Volume = 100
$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$s.SetOutputToWaveFile('${tmpWav.replace(/'/g, "''")}', $format)
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
  throw new Error("Failed to generate compact local TTS WAV");
}

const buf = generateCompactLocalTTS("Today I will do many tasks without using any technology at all. In the morning I read a book and drink tea peacefully. I sit outside in the garden and listen to birds.");
console.log("Compact buffer bytes:", buf.length);
