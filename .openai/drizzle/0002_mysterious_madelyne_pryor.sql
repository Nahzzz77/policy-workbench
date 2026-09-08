CREATE TABLE `company` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`industry` text DEFAULT '' NOT NULL,
	`region` text DEFAULT '' NOT NULL,
	`scale` text DEFAULT '' NOT NULL,
	`qualifications` text DEFAULT '' NOT NULL,
	`needs` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `policy_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`article_id` text NOT NULL,
	`title` text NOT NULL,
	`plan_date` text,
	`deadline` text,
	`remind_days` integer DEFAULT 90 NOT NULL,
	`status` text DEFAULT '待确认' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`deleted_at` text,
	`reminded_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_due` ON `policy_tasks` (`plan_date`,`deadline`);--> statement-breakpoint
CREATE INDEX `idx_tasks_company` ON `policy_tasks` (`company_id`);