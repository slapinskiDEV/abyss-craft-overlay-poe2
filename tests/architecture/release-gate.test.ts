// SoT §18.3 #28: the release gate fails on skipped real-data tests and on a missing snapshot.
import { describe, expect, it } from 'vitest';
import { evaluateTestReport, type VitestJsonReport } from '../../scripts/lib/release-gate';

const report = (statuses: string[]): VitestJsonReport => ({
  numTotalTests: statuses.length,
  numPassedTests: statuses.filter((s) => s === 'passed').length,
  numFailedTests: statuses.filter((s) => s === 'failed').length,
  numPendingTests: statuses.filter((s) => s === 'skipped' || s === 'pending').length,
  numTodoTests: 0,
  testResults: [{ name: 'TEST_ONLY.test.ts', assertionResults: statuses.map((status, i) => ({ fullName: `TEST_ONLY ${i}`, status })) }],
});

describe('release gate verdict', () => {
  it('passes only when every test passed', () => expect(evaluateTestReport(report(['passed', 'passed'])).ok).toBe(true));
  it('fails on a skipped test', () => expect(evaluateTestReport(report(['passed', 'skipped'])).ok).toBe(false));
  it('fails on a failed test', () => expect(evaluateTestReport(report(['failed'])).ok).toBe(false));
  it('fails when nothing ran', () => expect(evaluateTestReport(report([])).ok).toBe(false));
});
