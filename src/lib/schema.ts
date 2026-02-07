import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  introHeading: text("intro_heading").notNull().default("Welcome"),
  introBody: text("intro_body").notNull().default("You will be shown a series of images. For each one, share your impressions and vote."),
  outroHeading: text("outro_heading").notNull().default("Thank you!"),
  outroBody: text("outro_body").notNull().default("Your feedback has been recorded."),
  votingMode: text("voting_mode", { enum: ["binary", "scale", "pairwise"] }).notNull().default("binary"),
  randomizeOrder: integer("randomize_order", { mode: "boolean" }).notNull().default(false),
  code: text("code").notNull().unique(),
  createdAt: text("created_at").notNull(),
});

export const images = sqliteTable("images", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  videoFilename: text("video_filename"),
  label: text("label"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const responses = sqliteTable("responses", {
  id: text("id").primaryKey(),
  imageId: text("image_id").notNull().references(() => images.id, { onDelete: "cascade" }),
  sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  participantId: text("participant_id").notNull(),
  vote: integer("vote"),
  audioFilename: text("audio_filename"),
  transcription: text("transcription"),
  createdAt: text("created_at").notNull(),
});

// Outro voice recording (overall impressions, not tied to a specific image)
export const outroRecordings = sqliteTable("outro_recordings", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  participantId: text("participant_id").notNull(),
  audioFilename: text("audio_filename").notNull(),
  transcription: text("transcription"),
  createdAt: text("created_at").notNull(),
});

export const sessionsRelations = relations(sessions, ({ many }) => ({
  images: many(images),
  responses: many(responses),
  outroRecordings: many(outroRecordings),
}));

export const imagesRelations = relations(images, ({ one, many }) => ({
  session: one(sessions, { fields: [images.sessionId], references: [sessions.id] }),
  responses: many(responses),
}));

export const responsesRelations = relations(responses, ({ one }) => ({
  image: one(images, { fields: [responses.imageId], references: [images.id] }),
  session: one(sessions, { fields: [responses.sessionId], references: [sessions.id] }),
}));

export const outroRecordingsRelations = relations(outroRecordings, ({ one }) => ({
  session: one(sessions, { fields: [outroRecordings.sessionId], references: [sessions.id] }),
}));
