import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const leaderboard = sqliteTable('leaderboard', {
  id: text('id').primaryKey(),
  founderName: text('founder_name').notNull(),
  companyName: text('company_name').notNull(),
  score: integer('score').notNull(),
  amountRaised: integer('amount_raised').notNull().default(0),
  askAmount: integer('ask_amount').notNull().default(0),
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
