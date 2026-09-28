-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SalaryChangeKind" AS ENUM ('INITIAL', 'REVISION');

-- CreateTable
CREATE TABLE "hr_users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" UUID,
    "csrf_token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "employee_code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "country_code" VARCHAR(2) NOT NULL,
    "department" VARCHAR(100) NOT NULL,
    "job_level" VARCHAR(32) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "current_salaries" (
    "employee_id" UUID NOT NULL,
    "annual_base_amount" DECIMAL(18,2) NOT NULL,
    "currency_code" VARCHAR(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "current_salaries_pkey" PRIMARY KEY ("employee_id")
);

-- CreateTable
CREATE TABLE "salary_changes" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "kind" "SalaryChangeKind" NOT NULL,
    "previous_amount" DECIMAL(18,2),
    "new_amount" DECIMAL(18,2) NOT NULL,
    "currency_code" VARCHAR(3) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "changed_by_user_id" UUID,
    "salary_version" INTEGER NOT NULL,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hr_users_email_key" ON "hr_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_code_key" ON "employees"("employee_code");

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");

-- CreateIndex
CREATE INDEX "employees_country_code_idx" ON "employees"("country_code");

-- CreateIndex
CREATE INDEX "employees_department_idx" ON "employees"("department");

-- CreateIndex
CREATE INDEX "employees_job_level_idx" ON "employees"("job_level");

-- CreateIndex
CREATE INDEX "current_salaries_currency_code_idx" ON "current_salaries"("currency_code");

-- CreateIndex
CREATE INDEX "salary_changes_employee_id_recorded_at_id_idx" ON "salary_changes"("employee_id", "recorded_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "salary_changes_changed_by_user_id_idx" ON "salary_changes"("changed_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "salary_changes_employee_id_salary_version_key" ON "salary_changes"("employee_id", "salary_version");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "hr_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "current_salaries" ADD CONSTRAINT "current_salaries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_changes" ADD CONSTRAINT "salary_changes_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_changes" ADD CONSTRAINT "salary_changes_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "hr_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

