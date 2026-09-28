import { createHash, scrypt } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  generateSeedDataset,
  SEED_EMPLOYEE_COUNT,
  SEED_HR_ID,
} from './dataset.js';
import { hashSeedPassword } from './password.js';

const dataset = generateSeedDataset();
describe('synthetic employee dataset', () => {
  it('reproduces the complete dataset independent of time or randomness outside the generator', () => {
    const digest = (value: unknown) =>
      createHash('sha256').update(JSON.stringify(value)).digest('hex');
    expect(digest(generateSeedDataset())).toBe(digest(dataset));
    expect(dataset.employees).toHaveLength(SEED_EMPLOYEE_COUNT);
    expect(dataset.salaries).toHaveLength(SEED_EMPLOYEE_COUNT);
    expect(dataset.changes).toHaveLength(25_000);
    for (const field of ['id', 'employeeCode', 'email'] as const) {
      expect(
        new Set(dataset.employees.map((employee) => employee[field])).size,
      ).toBe(SEED_EMPLOYEE_COUNT);
    }
    expect(new Set(dataset.changes.map((change) => change.id)).size).toBe(
      25_000,
    );
  });
  it('covers every country, currency, department, and level without missing salary history', () => {
    expect(new Set(dataset.employees.map((e) => e.countryCode)).size).toBe(5);
    expect(new Set(dataset.employees.map((e) => e.department)).size).toBe(6);
    expect(new Set(dataset.employees.map((e) => e.jobLevel)).size).toBe(5);
    expect(new Set(dataset.salaries.map((s) => s.currencyCode))).toEqual(
      new Set(['INR', 'USD', 'GBP', 'EUR', 'JPY']),
    );
    const histories = new Map<string, typeof dataset.changes>();
    for (const change of dataset.changes) {
      const entries = histories.get(change.employeeId) ?? [];
      entries.push(change);
      histories.set(change.employeeId, entries);
    }
    for (const salary of dataset.salaries) {
      const entries = histories.get(salary.employeeId)!;
      expect(entries.length).toBeGreaterThanOrEqual(1);
      expect(entries.length).toBeLessThanOrEqual(4);
      expect(entries[0]?.kind).toBe('INITIAL');
      expect(entries[0]?.previousAmount).toBeNull();
      expect(entries[0]?.changedByUserId).toBeNull();
      entries.forEach((entry, index) => {
        expect(entry.salaryVersion).toBe(index + 1);
        expect(entry.currencyCode).toBe(salary.currencyCode);
        expect(String(entry.newAmount)).toMatch(
          salary.currencyCode === 'JPY' ? /^[1-9]\d*$/ : /^\d+\.\d{2}$/,
        );
        if (index > 0) {
          expect(entry.previousAmount).toBe(entries[index - 1]?.newAmount);
          expect(entry.changedByUserId).toBe(SEED_HR_ID);
          expect(new Date(entry.recordedAt!).getTime()).toBeGreaterThan(
            new Date(entries[index - 1]!.recordedAt!).getTime(),
          );
        }
      });
      expect(entries.at(-1)?.newAmount).toBe(salary.annualBaseAmount);
      expect(entries.at(-1)?.salaryVersion).toBe(salary.version);
      expect(entries.at(-1)?.recordedAt).toEqual(salary.updatedAt);
    }
  });
});

describe('demo password storage', () => {
  it('uses salted scrypt with reproducible verification, without storing plaintext', async () => {
    const password = 'ExampleTestPassword2026!';
    const encoded = await hashSeedPassword(password);
    const [algorithm, n, r, p, salt, hash] = encoded.split('$');
    expect(algorithm).toBe('scrypt');
    expect([n, r, p]).toEqual(['131072', '8', '1']);
    expect(salt).toMatch(/^[a-f0-9]{32}$/);
    expect(hash).toMatch(/^[a-f0-9]{128}$/);
    expect(encoded).not.toContain(password);
    const derived = await new Promise<Buffer>((resolve, reject) => {
      scrypt(
        password,
        Buffer.from(salt!, 'hex'),
        64,
        { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
        (error, key) => (error ? reject(error) : resolve(key)),
      );
    });
    expect(derived.toString('hex')).toBe(hash);
    expect(await hashSeedPassword(password)).not.toBe(encoded);
  });
  it('rejects missing/too-short or excessive passwords', async () => {
    await expect(hashSeedPassword('short')).rejects.toThrow('12 and 128');
    await expect(hashSeedPassword('x'.repeat(129))).rejects.toThrow(
      '12 and 128',
    );
  });
});
