ALTER TABLE `leaderboard` ADD `equity` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `leaderboard` ADD `difficulty` text DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE `leaderboard` ADD `opening_pitch` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `leaderboard` ADD `transcript` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `leaderboard` ADD `verdict_summary` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `leaderboard` ADD `tool_calls` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `leaderboard` ADD `founder_photo_material_id` text;
--> statement-breakpoint
UPDATE `leaderboard`
SET `equity` = 6,
    `difficulty` = 'legendary',
    `opening_pitch` = 'Judges, people spend billions every year trying to get unwanted guests out of their homes.

Pest control handles termites.

Locksmiths handle exes.

But nobody handles the dead.

Until now.

I’m Beetlejuice, founder of Ghosted — the first on-demand marketplace for paranormal eviction.

Here’s how it works.

A homeowner hears footsteps upstairs. Cabinets open by themselves. Their dead uncle Carl keeps changing the thermostat to 58 degrees.

They open Ghosted, describe the problem, upload a few photos, and our AI determines whether they’re dealing with a ghost, demon, poltergeist, cursed doll, or just an unusually aggressive raccoon.

If paranormal activity is confirmed, Ghosted dispatches a certified local Afterlife Removal Specialist.

Our average job costs $499.

We keep 30%.

Premium customers pay $19.99 a month for Ghosted Plus, which includes unlimited paranormal diagnostics, priority exorcisms, and one emergency possession reversal per year.

We’ve completed 1,842 hauntings, generated $720,000 in revenue, and our customer satisfaction rate is 94%.

The other 6% are currently unavailable for comment.

Our biggest competitive advantage is supply.

Traditional service marketplaces recruit plumbers and electricians.

I already know people on both sides.

Long term, Ghosted becomes the operating system for the afterlife economy: haunted real estate inspections, séance bookings, cursed-object removal, ghost insurance, and eventually cross-dimensional property management.

I’m asking for $666,666 for 6.66% of Ghosted.

And before anyone questions whether I’m the right founder…

I’ve been in this industry a very, very long time.

So who wants to make a deal?

Because if nobody invests…

I already know where all four of you live.',
    `transcript` = 'OPENING PITCH

Judges, people spend billions every year trying to get unwanted guests out of their homes. Pest control handles termites. Locksmiths handle exes. But nobody handles the dead. Until now. I’m Beetlejuice, founder of Ghosted — the first on-demand marketplace for paranormal eviction.

Our average job costs $499. We keep 30%. Premium customers pay $19.99 a month for Ghosted Plus. We’ve completed 1,842 hauntings, generated $720,000 in revenue, and our customer satisfaction rate is 94%.

FOUNDER ANSWERS

Trust me. I know what I’m doing. I’m the ghost with the most!

Please. I need the money to get rid of those people.

Have you ever heard of the Ghostbusters? How do you think they got so big? Yours truly!

Awesome. I got the customers, just need the cash!

Well, we have a 5 star rating on Yelp!',
    `verdict_summary` = 'Ghosted arrived with a killer costume, a sharp premise, and numbers that died under the first flashlight. Priya asked where $720,000 came from; Beetlejuice said “trust me.” Maya asked for one customer; he summoned Ghostbusters. Julian asked for a segment and moat; he asked for cash. Theo asked about safety, insurance, and profitable density; he pointed to Yelp. Four direct questions, four evasions, four judges gone. The founder was unforgettable. The business remained entirely supernatural.',
    `tool_calls` = '[{"name":"get_pitch_context","count":1},{"name":"review_pitch_evidence","count":1},{"name":"start_pitch","count":1},{"name":"post_judge_turn","count":9},{"name":"wait_for_founder_response","count":5},{"name":"wait_for_judge_rescue","count":5},{"name":"post_panel_verdict","count":1}]'
WHERE `id` = '3f0a36de-8a0d-4872-acd3-9f518890b00f';
