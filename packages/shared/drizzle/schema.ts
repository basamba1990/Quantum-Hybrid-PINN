import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, float, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Analyses table: Track all CFD simulation analyses
 */
export const analyses = mysqlTable("analyses", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  videoUrl: text("videoUrl").notNull(),
  videoKey: varchar("videoKey", { length: 512 }).notNull(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  progress: int("progress").default(0),
  credibilityScore: float("credibilityScore"),
  metrics: json("metrics"),
  residuals: json("residuals"),
  anomalies: text("anomalies"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type Analysis = typeof analyses.$inferSelect;
export type InsertAnalysis = typeof analyses.$inferInsert;

/**
 * Jobs table: Async job queue for long-running analyses
 */
export const jobs = mysqlTable("jobs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  analysisId: varchar("analysisId", { length: 36 }).notNull(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["video_analysis", "openfoam_import", "comparison"]).notNull(),
  status: mysqlEnum("status", ["queued", "processing", "completed", "failed"]).default("queued").notNull(),
  priority: int("priority").default(0),
  payload: json("payload").notNull(),
  result: json("result"),
  error: text("error"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
});

export type Job = typeof jobs.$inferSelect;
export type InsertJob = typeof jobs.$inferInsert;

/**
 * Analysis Results table: Detailed physics computation results
 */
export const analysisResults = mysqlTable("analysis_results", {
  id: varchar("id", { length: 36 }).primaryKey(),
  analysisId: varchar("analysisId", { length: 36 }).notNull().unique(),
  userId: int("userId").notNull(),
  velocityFieldU: json("velocityFieldU").notNull(),
  velocityFieldV: json("velocityFieldV").notNull(),
  pressureField: json("pressureField").notNull(),
  viscosityField: json("viscosityField").notNull(),
  continuityResidual: float("continuityResidual").notNull(),
  momentumResidual: float("momentumResidual").notNull(),
  energyResidual: float("energyResidual").notNull(),
  credibilityScore: float("credibilityScore").notNull(),
  anomalies: text("anomalies"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AnalysisResult = typeof analysisResults.$inferSelect;
export type InsertAnalysisResult = typeof analysisResults.$inferInsert;