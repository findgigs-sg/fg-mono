import { pgEnum, pgTable, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { user } from "./auth-schema";

export const Post = pgTable("post", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  title: t.varchar({ length: 256 }).notNull(),
  content: t.text().notNull(),
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => new Date()),
}));

export const CreatePostSchema = createInsertSchema(Post, {
  title: z.string().max(256),
  content: z.string().max(256),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const roleEnum = pgEnum("role", ["worker", "employer"]);

/**
 * Slim core profile — identity + routing fields.
 * Worker/employer-specific data lives in WorkerProfile / EmployerProfile.
 */
export const Profile = pgTable("profile", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  userId: t
    .text()
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  role: roleEnum().notNull(),
  onboardingComplete: t.boolean().notNull().default(false),
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => new Date()),
}));

export const WorkerProfile = pgTable("worker_profile", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  userId: t
    .text()
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  fullName: t.varchar({ length: 256 }).notNull(),
  phone: t.varchar({ length: 32 }).notNull(),
  bio: t.varchar({ length: 300 }),
  photoUrl: t.text(),
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => new Date()),
}));

export const EmployerProfile = pgTable("employer_profile", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  userId: t
    .text()
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  orgName: t.varchar({ length: 256 }).notNull(),
  contactName: t.varchar({ length: 256 }).notNull(),
  phone: t.varchar({ length: 32 }).notNull(),
  description: t.varchar({ length: 500 }),
  logoUrl: t.text(),
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => new Date()),
}));

export const JobCategory = pgTable("job_category", (t) => ({
  id: t.serial().primaryKey(),
  slug: t.varchar({ length: 64 }).notNull().unique(),
  label: t.varchar({ length: 128 }).notNull(),
  sortOrder: t.integer().notNull().default(0),
}));

export const WorkerJobCategory = pgTable(
  "worker_job_category",
  (t) => ({
    workerUserId: t
      .text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    jobCategoryId: t
      .integer()
      .notNull()
      .references(() => JobCategory.id, { onDelete: "cascade" }),
  }),
  (table) => [
    primaryKey({ columns: [table.workerUserId, table.jobCategoryId] }),
  ],
);

export const Venue = pgTable("venue", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  employerUserId: t
    .text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: t.varchar({ length: 256 }).notNull(),
  address: t.text().notNull(),
  description: t.varchar({ length: 300 }),
  photoUrl: t.text(),
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => new Date()),
}));

export * from "./auth-schema";
