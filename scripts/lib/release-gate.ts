// Pure verdict over a Vitest JSON report: any failed or skipped test fails the release gate.
export interface VitestJsonReport {
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
  numTodoTests: number;
  testResults: Array<{ name: string; assertionResults: Array<{ fullName: string; status: string }> }>;
}

export function evaluateTestReport(report: VitestJsonReport): { ok: boolean; passed: number; problems: string[] } {
  const problems: string[] = [];
  for (const file of report.testResults) {
    for (const a of file.assertionResults) {
      if (a.status !== 'passed') problems.push(`${a.status.toUpperCase()}: ${a.fullName} (${file.name})`);
    }
  }
  if (report.numTotalTests === 0) problems.push('no tests ran');
  if (report.numPendingTests + report.numTodoTests > 0 && problems.length === 0) problems.push('skipped tests present');
  return { ok: problems.length === 0 && report.numFailedTests === 0, passed: report.numPassedTests, problems };
}
