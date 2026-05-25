import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const contacts = pgTable("contacts", {
  id: text().primaryKey(),
  name: text().notNull(),
  phone: text().notNull(),
  email: text().notNull(),
  course: text().notNull(),
  billing: text().notNull(),
  amount: integer().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
