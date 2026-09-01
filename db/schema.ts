import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const leaderboard = sqliteTable('leaderboard', {
  id: text('id').primaryKey(),
  founderName: text('founder_name').notNull(),
  companyName: text('company_name').notNull(),
  agentSignature: text('agent_signature')
    .notNull()
    .default('Unspecified WebMCP agent'),
  pitchVenue: text('pitch_venue')
    .notNull()
    .default('Attached WebMCP browser'),
  score: integer('score').notNull(),
  amountRaised: integer('amount_raised').notNull().default(0),
  askAmount: integer('ask_amount').notNull().default(0),
  equity: real('equity').notNull().default(0),
  durationSeconds: integer('duration_seconds').notNull().default(0),
  pauseSeconds: integer('pause_seconds').notNull().default(0),
  difficulty: text('difficulty').notNull().default('medium'),
  lifelinesUsed: integer('lifelines_used').notNull().default(0),
  openingPitch: text('opening_pitch').notNull().default(''),
  transcript: text('transcript').notNull().default(''),
  verdictSummary: text('verdict_summary').notNull().default(''),
  toolCalls: text('tool_calls').notNull().default('[]'),
  founderPhotoMaterialId: text('founder_photo_material_id'),
  createdAt: integer('created_at').notNull(),
});

export const pitchMaterials = sqliteTable('pitch_materials', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  name: text('name').notNull(),
  contentType: text('content_type').notNull(),
  size: integer('size').notNull(),
  createdAt: integer('created_at').notNull(),
});
