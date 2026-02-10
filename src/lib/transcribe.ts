import OpenAI from "openai";
import fs from "fs";
import path from "path";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export function isTranscriptionAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export async function transcribeAudioFile(filename: string): Promise<string> {
  const filePath = path.join(process.cwd(), "data", "uploads", filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Audio file not found: ${filename}`);
  }
  const file = fs.createReadStream(filePath);
  const response = await getClient().audio.transcriptions.create({
    model: "whisper-1",
    file,
  });
  return response.text;
}
