import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: text("created_at").notNull(),
});

export const projectsRelations = relations(projects, ({ many }) => ({
  surveys: many(surveys),
}));

export const surveys = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  introHeading: text("intro_heading").notNull().default("Welcome"),
  introBody: text("intro_body").notNull().default("You will be shown a series of images. For each one, share your impressions and vote."),
  outroHeading: text("outro_heading").notNull().default("Thank you!"),
  outroBody: text("outro_body").notNull().default("Your feedback has been recorded."),
  introMediaFilename: text("intro_media_filename"),
  outroMediaFilename: text("outro_media_filename"),
  introAudioFilename: text("intro_audio_filename"),
  outroAudioFilename: text("outro_audio_filename"),
  narrationTiming: text("narration_timing").notNull().default("simultaneous"),
  votingMode: text("voting_mode", { enum: ["binary", "scale", "pairwise", "guided_tour"] }).notNull().default("binary"),
  language: text("language").notNull().default("en"),
  randomizeOrder: integer("randomize_order", { mode: "boolean" }).notNull().default(false),
  autoRecord: integer("auto_record", { mode: "boolean" }).notNull().default(false),
  autoTranscribe: integer("auto_transcribe", { mode: "boolean" }).notNull().default(false),
  projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
  code: text("code").notNull().unique(),
  createdAt: text("created_at").notNull(),
});

export const images = sqliteTable("images", {
  id: text("id").primaryKey(),
  surveyId: text("session_id").notNull().references(() => surveys.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  videoFilename: text("video_filename"),
  audioFilename: text("audio_filename"),
  label: text("label"),
  caption: text("caption"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const responses = sqliteTable("responses", {
  id: text("id").primaryKey(),
  imageId: text("image_id").notNull().references(() => images.id, { onDelete: "cascade" }),
  surveyId: text("session_id").notNull().references(() => surveys.id, { onDelete: "cascade" }),
  participantId: text("participant_id").notNull(),
  vote: integer("vote"),
  audioFilename: text("audio_filename"),
  transcription: text("transcription"),
  createdAt: text("created_at").notNull(),
});

// Outro voice recording (overall impressions, not tied to a specific image)
export const outroRecordings = sqliteTable("outro_recordings", {
  id: text("id").primaryKey(),
  surveyId: text("session_id").notNull().references(() => surveys.id, { onDelete: "cascade" }),
  participantId: text("participant_id").notNull(),
  audioFilename: text("audio_filename").notNull(),
  transcription: text("transcription"),
  createdAt: text("created_at").notNull(),
});

export const surveysRelations = relations(surveys, ({ one, many }) => ({
  project: one(projects, { fields: [surveys.projectId], references: [projects.id] }),
  images: many(images),
  responses: many(responses),
  outroRecordings: many(outroRecordings),
  pairwiseResponses: many(pairwiseResponses),
  participants: many(participants),
}));

export const imagesRelations = relations(images, ({ one, many }) => ({
  survey: one(surveys, { fields: [images.surveyId], references: [surveys.id] }),
  responses: many(responses),
}));

export const responsesRelations = relations(responses, ({ one }) => ({
  image: one(images, { fields: [responses.imageId], references: [images.id] }),
  survey: one(surveys, { fields: [responses.surveyId], references: [surveys.id] }),
}));

export const pairwiseResponses = sqliteTable("pairwise_responses", {
  id: text("id").primaryKey(),
  surveyId: text("session_id").notNull().references(() => surveys.id, { onDelete: "cascade" }),
  participantId: text("participant_id").notNull(),
  imageAId: text("image_a_id").notNull().references(() => images.id, { onDelete: "cascade" }),
  imageBId: text("image_b_id").notNull().references(() => images.id, { onDelete: "cascade" }),
  winnerId: text("winner_id").references(() => images.id, { onDelete: "cascade" }),
  score: integer("score"),
  audioFilename: text("audio_filename"),
  transcription: text("transcription"),
  createdAt: text("created_at").notNull(),
});

export const outroRecordingsRelations = relations(outroRecordings, ({ one }) => ({
  survey: one(surveys, { fields: [outroRecordings.surveyId], references: [surveys.id] }),
}));

export const pairwiseResponsesRelations = relations(pairwiseResponses, ({ one }) => ({
  survey: one(surveys, { fields: [pairwiseResponses.surveyId], references: [surveys.id] }),
  imageA: one(images, { fields: [pairwiseResponses.imageAId], references: [images.id], relationName: "imageA" }),
  imageB: one(images, { fields: [pairwiseResponses.imageBId], references: [images.id], relationName: "imageB" }),
  winner: one(images, { fields: [pairwiseResponses.winnerId], references: [images.id], relationName: "winner" }),
}));

export const participants = sqliteTable("participants", {
  id: text("id").primaryKey(),
  surveyId: text("session_id").notNull().references(() => surveys.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  age: integer("age"),
  lastSeenAt: text("last_seen_at"),
  createdAt: text("created_at").notNull(),
});

export const participantsRelations = relations(participants, ({ one }) => ({
  survey: one(surveys, { fields: [participants.surveyId], references: [surveys.id] }),
}));

export const orderInterests = sqliteTable("order_interests", {
  id: text("id").primaryKey(),
  surveyId: text("session_id").notNull().references(() => surveys.id, { onDelete: "cascade" }),
  participantId: text("participant_id").notNull(),
  email: text("email").notNull(),
  imageIds: text("image_ids").notNull(), // JSON array of image IDs
  createdAt: text("created_at").notNull(),
});

export const orderInterestsRelations = relations(orderInterests, ({ one }) => ({
  survey: one(surveys, { fields: [orderInterests.surveyId], references: [surveys.id] }),
}));
