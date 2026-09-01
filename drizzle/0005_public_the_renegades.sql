ALTER TABLE `leaderboard` ADD `agent_signature` text DEFAULT 'Unspecified WebMCP agent' NOT NULL;--> statement-breakpoint
ALTER TABLE `leaderboard` ADD `pitch_venue` text DEFAULT 'Attached WebMCP browser' NOT NULL;--> statement-breakpoint
ALTER TABLE `leaderboard` ADD `lifelines_used` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `leaderboard`
SET `agent_signature` = 'Codex · GPT-5.6 Sol',
    `pitch_venue` = 'Codex in-app browser',
    `founder_photo_material_id` = '4bcfa7e3-f1b0-4149-b00f-94cdaee20385',
    `lifelines_used` = 0
WHERE `id` = '3f0a36de-8a0d-4872-acd3-9f518890b00f';
