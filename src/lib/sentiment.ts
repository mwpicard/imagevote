import OpenAI from "openai";
import { db } from "@/lib/db";
import { responses, pairwiseResponses, outroRecordings } from "@/lib/schema";
import { eq } from "drizzle-orm";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

export type Sentiment = "positive" | "neutral" | "negative";

// Multilingual keyword lists for local fallback
const POSITIVE_WORDS: Record<string, string[]> = {
  en: ["love", "great", "good", "nice", "like", "beautiful", "amazing", "awesome", "excellent", "wonderful", "fantastic", "best", "perfect", "happy", "enjoy", "cool", "pretty", "prefer", "favorite", "favourite", "yes"],
  es: ["encanta", "genial", "bueno", "bonito", "gusta", "hermoso", "increíble", "excelente", "maravilloso", "fantástico", "mejor", "perfecto", "feliz", "bien", "favorito", "favorita", "sí", "mola", "guay"],
  ca: ["encanta", "genial", "bo", "bonic", "agrada", "formós", "increïble", "excel·lent", "meravellós", "fantàstic", "millor", "perfecte", "feliç", "favorit", "favorita", "sí", "maco"],
};

const NEGATIVE_WORDS: Record<string, string[]> = {
  en: ["hate", "bad", "ugly", "terrible", "awful", "horrible", "worst", "boring", "dislike", "no", "don't", "not", "never", "poor", "disappointing", "annoying", "gross", "weird"],
  es: ["odio", "malo", "feo", "terrible", "horrible", "peor", "aburrido", "no", "nunca", "pobre", "decepcionante", "molesto", "raro"],
  ca: ["odi", "dolent", "lleig", "terrible", "horrible", "pitjor", "avorrit", "no", "mai", "pobre", "decebedor", "molest", "estrany"],
};

function localSentiment(text: string): Sentiment {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);

  let positiveScore = 0;
  let negativeScore = 0;

  for (const lang of Object.keys(POSITIVE_WORDS)) {
    for (const word of POSITIVE_WORDS[lang]) {
      if (words.some((w) => w.includes(word))) positiveScore++;
    }
    for (const word of NEGATIVE_WORDS[lang]) {
      if (words.some((w) => w.includes(word))) negativeScore++;
    }
  }

  if (positiveScore > negativeScore) return "positive";
  if (negativeScore > positiveScore) return "negative";
  return "neutral";
}

export async function analyzeSentiment(text: string): Promise<Sentiment> {
  if (!text.trim()) return "neutral";

  // OpenAI path: cheap, fast single-word classification
  if (process.env.OPENAI_API_KEY) {
    try {
      const response = await getOpenAIClient().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Classify the sentiment of the following text as exactly one word: positive, neutral, or negative. Respond with only that single word.",
          },
          { role: "user", content: text },
        ],
        max_tokens: 5,
        temperature: 0,
      });
      const result = response.choices[0]?.message?.content?.trim().toLowerCase();
      if (result === "positive" || result === "neutral" || result === "negative") {
        return result;
      }
      // Fallback if unexpected response
      return localSentiment(text);
    } catch (err) {
      console.error("[analyzeSentiment] OpenAI failed, using local fallback:", err);
      return localSentiment(text);
    }
  }

  // Local fallback
  return localSentiment(text);
}

/**
 * Analyze sentiment of a transcription and save to DB.
 * Designed to be chained after transcription — never throws.
 */
export async function analyzeSentimentAndSave(
  text: string,
  recordId: string,
  table: "responses" | "pairwiseResponses" | "outroRecordings",
): Promise<void> {
  try {
    const sentiment = await analyzeSentiment(text);
    if (table === "responses") {
      await db.update(responses).set({ sentiment }).where(eq(responses.id, recordId));
    } else if (table === "pairwiseResponses") {
      await db.update(pairwiseResponses).set({ sentiment }).where(eq(pairwiseResponses.id, recordId));
    } else {
      await db.update(outroRecordings).set({ sentiment }).where(eq(outroRecordings.id, recordId));
    }
  } catch (err) {
    console.error(`[analyzeSentimentAndSave] Failed for ${table}/${recordId}:`, err);
  }
}
