import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

// Always available — local Whisper is the fallback
export function isTranscriptionAvailable(): boolean {
  return true;
}

// Lazy-loaded local Whisper pipeline
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let localPipeline: any = null;

async function getLocalPipeline() {
  if (!localPipeline) {
    const { pipeline } = await import("@huggingface/transformers");
    localPipeline = await pipeline(
      "automatic-speech-recognition",
      "onnx-community/whisper-base",
    );
  }
  return localPipeline;
}

/** Convert audio to 16kHz mono WAV using bundled ffmpeg-static */
function convertToWav(inputPath: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ffmpegPath = require("ffmpeg-static") as string;
  const wavPath = inputPath + ".tmp.wav";
  execFileSync(ffmpegPath, [
    "-i", inputPath,
    "-ar", "16000",
    "-ac", "1",
    "-c:a", "pcm_s16le",
    wavPath,
    "-y",
  ], { stdio: "pipe" });
  return wavPath;
}

/** Parse a 16-bit PCM WAV file into Float32Array samples */
function readWavAsFloat32(wavPath: string): Float32Array {
  const buffer = fs.readFileSync(wavPath);
  // Find "data" chunk
  const dataIdx = buffer.indexOf(Buffer.from("data"));
  if (dataIdx === -1) throw new Error("Invalid WAV: no data chunk");
  const dataStart = dataIdx + 8; // skip "data" + 4-byte size
  const pcm16 = new Int16Array(
    buffer.buffer,
    buffer.byteOffset + dataStart,
    (buffer.length - dataStart) / 2,
  );
  const float32 = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) {
    float32[i] = pcm16[i] / 32768;
  }
  return float32;
}

export async function transcribeAudioFile(filename: string): Promise<string> {
  const filePath = path.join(process.cwd(), "data", "uploads", filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Audio file not found: ${filename}`);
  }

  // Option 1: OpenAI API (fastest, best quality)
  if (process.env.OPENAI_API_KEY) {
    const file = fs.createReadStream(filePath);
    const response = await getOpenAIClient().audio.transcriptions.create({
      model: "whisper-1",
      file,
    });
    return response.text;
  }

  // Option 2: Local Whisper via transformers.js
  let wavPath: string | null = null;
  try {
    wavPath = convertToWav(filePath);
    const samples = readWavAsFloat32(wavPath);
    const transcriber = await getLocalPipeline();
    const result = await transcriber(samples);
    return result.text?.trim() || "";
  } finally {
    if (wavPath && fs.existsSync(wavPath)) {
      fs.unlinkSync(wavPath);
    }
  }
}
