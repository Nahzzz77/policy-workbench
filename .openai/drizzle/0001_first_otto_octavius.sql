CREATE TABLE `digests` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`body` text NOT NULL,
	`engine` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
