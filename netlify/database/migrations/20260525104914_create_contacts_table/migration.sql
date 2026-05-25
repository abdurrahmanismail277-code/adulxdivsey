CREATE TABLE "contacts" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"course" text NOT NULL,
	"billing" text NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
