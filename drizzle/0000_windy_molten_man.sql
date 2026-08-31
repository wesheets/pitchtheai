CREATE TABLE `leaderboard` (
	`id` text PRIMARY KEY NOT NULL,
	`founder_name` text NOT NULL,
	`company_name` text NOT NULL,
	`score` integer NOT NULL,
	`amount_raised` integer DEFAULT 0 NOT NULL,
	`ask_amount` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
