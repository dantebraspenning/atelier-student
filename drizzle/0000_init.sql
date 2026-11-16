CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_rate_limit" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"student_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"total_cents" integer NOT NULL,
	"fee_cents" integer NOT NULL,
	"handover" text NOT NULL,
	"status" text DEFAULT 'pending_payment' NOT NULL,
	"payment_status" text DEFAULT 'unpaid' NOT NULL,
	"alteration_included" boolean DEFAULT false NOT NULL,
	"alteration_used" boolean DEFAULT false NOT NULL,
	"alteration_note" text DEFAULT '' NOT NULL,
	"tracking_url" text,
	"sent_at" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"completed_by" text,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text DEFAULT '' NOT NULL,
	"cancel_proposed_by" text,
	"cancel_refund_cents" integer,
	"cancel_proposed_at" timestamp with time zone,
	"checkout_session_id" text,
	"payment_intent_id" text,
	"charge_id" text,
	"transfer_id" text,
	"paid_at" timestamp with time zone,
	"refunded_cents" integer DEFAULT 0 NOT NULL,
	"released_cents" integer DEFAULT 0 NOT NULL,
	"in_portfolio" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispute" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"commission_id" uuid NOT NULL,
	"opened_by" text NOT NULL,
	"reason" text NOT NULL,
	"details" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution" text,
	"refund_cents" integer,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to" text NOT NULL,
	"template" text NOT NULL,
	"subject" text NOT NULL,
	"html" text NOT NULL,
	"text" text NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"request_id" uuid NOT NULL,
	"student_id" text NOT NULL,
	"sender_id" text,
	"body" text DEFAULT '' NOT NULL,
	"kind" text DEFAULT 'text' NOT NULL,
	"event" jsonb,
	"hidden_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"href" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_event" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"storage_key" text NOT NULL,
	"thumb_key" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bytes" integer NOT NULL,
	"request_id" uuid,
	"portfolio_id" uuid,
	"message_id" bigint,
	"verification_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"hidden_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photo_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "photo_thumb_key_unique" UNIQUE("thumb_key")
);
--> statement-breakpoint
CREATE TABLE "portfolio_piece" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" text NOT NULL,
	"title" text NOT NULL,
	"garment" text NOT NULL,
	"material" text DEFAULT '' NOT NULL,
	"kind" text DEFAULT 'coursework' NOT NULL,
	"story" text DEFAULT '' NOT NULL,
	"commission_id" uuid,
	"hidden_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"student_id" text NOT NULL,
	"labour_cents" integer NOT NULL,
	"fabric_cents" integer DEFAULT 0 NOT NULL,
	"shipping_cents" integer DEFAULT 0 NOT NULL,
	"handover" text NOT NULL,
	"alteration" boolean DEFAULT false NOT NULL,
	"ready_by" date,
	"message" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_amounts" CHECK ("quote"."labour_cents" > 0 and "quote"."fabric_cents" >= 0 and "quote"."shipping_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" text,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"reason" text NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"handled_by" text,
	"handled_at" timestamp with time zone,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" text NOT NULL,
	"garment" text NOT NULL,
	"purpose" text DEFAULT '' NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"measurements" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"measure_in_person" boolean DEFAULT false NOT NULL,
	"fabric" text DEFAULT 'source' NOT NULL,
	"budget_cents" integer,
	"needed_by" date,
	"delivery" text DEFAULT 'either' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"target_student_id" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_pass" (
	"student_id" text NOT NULL,
	"request_id" uuid NOT NULL,
	CONSTRAINT "request_pass_student_id_request_id_pk" PRIMARY KEY("student_id","request_id")
);
--> statement-breakpoint
CREATE TABLE "review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"commission_id" uuid NOT NULL,
	"customer_id" text NOT NULL,
	"student_id" text NOT NULL,
	"rating" integer NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"reply" text,
	"replied_at" timestamp with time zone,
	"hidden_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_commission_id_unique" UNIQUE("commission_id"),
	CONSTRAINT "review_rating" CHECK ("review"."rating" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "student_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"programme" text DEFAULT '' NOT NULL,
	"school" text DEFAULT '' NOT NULL,
	"year" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"specialities" text[] DEFAULT '{}'::text[] NOT NULL,
	"skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"turnaround" text DEFAULT '' NOT NULL,
	"accepting" boolean DEFAULT true NOT NULL,
	"rates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"verification" text DEFAULT 'unverified' NOT NULL,
	"verified_at" timestamp with time zone,
	"stripe_account_id" text,
	"payouts_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_profile_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "student_verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"method" text NOT NULL,
	"school_email" text,
	"token_hash" text,
	"expires_at" timestamp with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_details" (
	"user_id" text PRIMARY KEY NOT NULL,
	"legal_name" text NOT NULL,
	"date_of_birth" date NOT NULL,
	"address_line" text NOT NULL,
	"postal_code" text NOT NULL,
	"city" text NOT NULL,
	"country" text DEFAULT 'NL' NOT NULL,
	"tin_encrypted" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "thread_read" (
	"user_id" text NOT NULL,
	"request_id" uuid NOT NULL,
	"student_id" text NOT NULL,
	"last_read_id" bigint DEFAULT 0 NOT NULL,
	"last_emailed_at" timestamp with time zone,
	CONSTRAINT "thread_read_user_id_request_id_student_id_pk" PRIMARY KEY("user_id","request_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role" text DEFAULT 'customer' NOT NULL,
	"locale" text DEFAULT 'nl' NOT NULL,
	"notify_messages" boolean DEFAULT true NOT NULL,
	"suspended_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission" ADD CONSTRAINT "commission_request_id_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."request"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission" ADD CONSTRAINT "commission_quote_id_quote_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission" ADD CONSTRAINT "commission_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission" ADD CONSTRAINT "commission_customer_id_user_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission" ADD CONSTRAINT "commission_cancel_proposed_by_user_id_fk" FOREIGN KEY ("cancel_proposed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_commission_id_commission_id_fk" FOREIGN KEY ("commission_id") REFERENCES "public"."commission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_opened_by_user_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_request_id_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo" ADD CONSTRAINT "photo_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo" ADD CONSTRAINT "photo_request_id_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo" ADD CONSTRAINT "photo_portfolio_id_portfolio_piece_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolio_piece"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo" ADD CONSTRAINT "photo_message_id_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo" ADD CONSTRAINT "photo_verification_id_student_verification_id_fk" FOREIGN KEY ("verification_id") REFERENCES "public"."student_verification"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_piece" ADD CONSTRAINT "portfolio_piece_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_piece" ADD CONSTRAINT "portfolio_piece_commission_id_commission_id_fk" FOREIGN KEY ("commission_id") REFERENCES "public"."commission"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote" ADD CONSTRAINT "quote_request_id_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote" ADD CONSTRAINT "quote_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_handled_by_user_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request" ADD CONSTRAINT "request_customer_id_user_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request" ADD CONSTRAINT "request_target_student_id_user_id_fk" FOREIGN KEY ("target_student_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_pass" ADD CONSTRAINT "request_pass_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_pass" ADD CONSTRAINT "request_pass_request_id_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_commission_id_commission_id_fk" FOREIGN KEY ("commission_id") REFERENCES "public"."commission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_customer_id_user_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profile" ADD CONSTRAINT "student_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_verification" ADD CONSTRAINT "student_verification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_verification" ADD CONSTRAINT "student_verification_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_details" ADD CONSTRAINT "tax_details_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_read" ADD CONSTRAINT "thread_read_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_read" ADD CONSTRAINT "thread_read_request_id_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_read" ADD CONSTRAINT "thread_read_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "commission_request_live_uq" ON "commission" USING btree ("request_id") WHERE "commission"."status" <> 'cancelled';--> statement-breakpoint
CREATE INDEX "commission_student_idx" ON "commission" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "commission_customer_idx" ON "commission" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "commission_status_idx" ON "commission" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dispute_status_idx" ON "dispute" USING btree ("status");--> statement-breakpoint
CREATE INDEX "email_outbox_created_idx" ON "email_outbox" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "message_thread_idx" ON "message" USING btree ("request_id","student_id","id");--> statement-breakpoint
CREATE INDEX "notification_user_idx" ON "notification" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "photo_request_idx" ON "photo" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "photo_portfolio_idx" ON "photo" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "photo_message_idx" ON "photo" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "photo_owner_idx" ON "photo" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "portfolio_student_idx" ON "portfolio_piece" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quote_request_student_uq" ON "quote" USING btree ("request_id","student_id");--> statement-breakpoint
CREATE INDEX "report_status_idx" ON "report" USING btree ("status");--> statement-breakpoint
CREATE INDEX "request_customer_idx" ON "request" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "request_status_idx" ON "request" USING btree ("status","garment");--> statement-breakpoint
CREATE INDEX "review_student_idx" ON "review" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "student_verification_user_idx" ON "student_verification" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");