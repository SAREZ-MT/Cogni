CREATE TABLE "generation_fingerprints" (
	"owner_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"technique" text NOT NULL,
	"fingerprint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "generation_fingerprints_pkey" PRIMARY KEY("page_id","owner_id","technique","fingerprint"),
	CONSTRAINT "generation_fingerprints_technique_check" CHECK ("generation_fingerprints"."technique" in ('flashcards', 'exam', 'recall')),
	CONSTRAINT "generation_fingerprints_fingerprint_format" CHECK ("generation_fingerprints"."fingerprint" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "generation_fingerprints" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "generation_fingerprints" ADD CONSTRAINT "generation_fingerprints_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_fingerprints" ADD CONSTRAINT "generation_fingerprints_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generation_fingerprints_owner_id_idx" ON "generation_fingerprints" USING btree ("owner_id");