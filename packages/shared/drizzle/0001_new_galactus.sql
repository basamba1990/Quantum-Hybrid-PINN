CREATE TABLE `analyses` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`videoUrl` text NOT NULL,
	`videoKey` varchar(512) NOT NULL,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`progress` int DEFAULT 0,
	`credibilityScore` float,
	`metrics` json,
	`residuals` json,
	`anomalies` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	CONSTRAINT `analyses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `analysis_results` (
	`id` varchar(36) NOT NULL,
	`analysisId` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`velocityFieldU` json NOT NULL,
	`velocityFieldV` json NOT NULL,
	`pressureField` json NOT NULL,
	`viscosityField` json NOT NULL,
	`continuityResidual` float NOT NULL,
	`momentumResidual` float NOT NULL,
	`energyResidual` float NOT NULL,
	`credibilityScore` float NOT NULL,
	`anomalies` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analysis_results_id` PRIMARY KEY(`id`),
	CONSTRAINT `analysis_results_analysisId_unique` UNIQUE(`analysisId`)
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` varchar(36) NOT NULL,
	`analysisId` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`type` enum('video_analysis','openfoam_import','comparison') NOT NULL,
	`status` enum('queued','processing','completed','failed') NOT NULL DEFAULT 'queued',
	`priority` int DEFAULT 0,
	`payload` json NOT NULL,
	`result` json,
	`error` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`startedAt` timestamp,
	`completedAt` timestamp,
	CONSTRAINT `jobs_id` PRIMARY KEY(`id`)
);