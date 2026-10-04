CREATE TABLE "ai_generations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"page_id" uuid,
	"purpose" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_generations_status_check" CHECK ("ai_generations"."status" in ('queued', 'running', 'done', 'failed')),
	CONSTRAINT "ai_generations_purpose_check" CHECK ("ai_generations"."purpose" in ('generate_flashcards', 'generate_exam_questions', 'generate_exam_variants', 'generate_recall_questions', 'evaluate_recall_answer', 'session_feedback'))
);
--> statement-breakpoint
ALTER TABLE "ai_generations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "flashcards" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"generation_id" uuid,
	"front" text NOT NULL,
	"back" text NOT NULL,
	"origin" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flashcards_origin_check" CHECK ("flashcards"."origin" in ('ai', 'manual')),
	CONSTRAINT "flashcards_front_not_blank" CHECK (length(btrim("flashcards"."front")) > 0),
	CONSTRAINT "flashcards_back_not_blank" CHECK (length(btrim("flashcards"."back")) > 0)
);
--> statement-breakpoint
ALTER TABLE "flashcards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_generation_id_ai_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."ai_generations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_generations_owner_created_idx" ON "ai_generations" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_generations_page_id_idx" ON "ai_generations" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "flashcards_page_position_idx" ON "flashcards" USING btree ("page_id","position");--> statement-breakpoint
CREATE INDEX "flashcards_owner_id_idx" ON "flashcards" USING btree ("owner_id");