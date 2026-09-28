-- Prisma models cannot express CHECK constraints. Keep these versioned SQL rules.
ALTER TABLE hr_users ADD CONSTRAINT hr_users_normalized_email
  CHECK (email = lower(btrim(email)) AND length(email) > 0);
ALTER TABLE employees ADD CONSTRAINT employees_valid_profile
  CHECK (country_code ~ '^[A-Z]{2}$' AND length(btrim(name)) > 0
    AND length(btrim(employee_code)) > 0 AND length(btrim(department)) > 0
    AND length(btrim(job_level)) > 0 AND email = lower(btrim(email)) AND length(email) > 0);
ALTER TABLE sessions ADD CONSTRAINT sessions_valid_lifetime CHECK (expires_at > created_at);

ALTER TABLE current_salaries
  ADD CONSTRAINT current_salaries_positive_amount CHECK (annual_base_amount > 0 AND annual_base_amount <= 9999999999999999.99),
  ADD CONSTRAINT current_salaries_supported_currency CHECK (currency_code IN ('INR','USD','GBP','EUR','JPY')),
  ADD CONSTRAINT current_salaries_currency_precision CHECK (currency_code <> 'JPY' OR annual_base_amount = trunc(annual_base_amount)),
  ADD CONSTRAINT current_salaries_positive_version CHECK (version > 0);

ALTER TABLE salary_changes
  ADD CONSTRAINT salary_changes_positive_amounts CHECK (
    new_amount > 0 AND new_amount <= 9999999999999999.99
    AND (previous_amount IS NULL OR (previous_amount > 0 AND previous_amount <= 9999999999999999.99))),
  ADD CONSTRAINT salary_changes_supported_currency CHECK (currency_code IN ('INR','USD','GBP','EUR','JPY')),
  ADD CONSTRAINT salary_changes_currency_precision CHECK (
    currency_code <> 'JPY' OR (new_amount = trunc(new_amount)
    AND (previous_amount IS NULL OR previous_amount = trunc(previous_amount)))),
  ADD CONSTRAINT salary_changes_reason CHECK (reason = btrim(reason) AND length(reason) BETWEEN 3 AND 500),
  ADD CONSTRAINT salary_changes_valid_kind CHECK (
    (kind = 'INITIAL' AND previous_amount IS NULL AND changed_by_user_id IS NULL AND salary_version = 1)
    OR (kind = 'REVISION' AND previous_amount IS NOT NULL AND changed_by_user_id IS NOT NULL
      AND salary_version > 1 AND previous_amount <> new_amount));
