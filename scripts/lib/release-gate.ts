// Pure verdict over a Vitest JSON report: any failed or skipped test, and any test file that failed
// to load, fails the release gate. (A file that throws while loading has no assertion results; it
// used to vanish from the count instead of failing the gate.)
export interface VitestJsonReport {
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
  numTodoTests: number;
  numFailedTestSuites?: number;
  success?: boolean;
  testResults: Array<{ name: string; status?: string; message?: string; assertionResults: Array<{ fullName: string; status: string }> }>;
}

export function evaluateTestReport(report: VitestJsonReport): { ok: boolean; passed: number; problems: string[] } {
  const problems: string[] = [];
  for (const file of report.testResults) {
    if (file.status !== undefined && file.status !== 'passed') problems.push(`FILE ${file.status.toUpperCase()}: ${file.name}${file.message ? ` — ${file.message.split('\n')[0]}` : ''}`);
    for (const a of file.assertionResults) {
      if (a.status !== 'passed') problems.push(`${a.status.toUpperCase()}: ${a.fullName} (${file.name})`);
    }
  }
  if (report.numTotalTests === 0) problems.push('no tests ran');
  if ((report.numFailedTestSuites ?? 0) > 0 && !problems.some((p) => p.startsWith('FILE '))) problems.push(`${report.numFailedTestSuites} test file(s) failed`);
  if (report.success === false && problems.length === 0) problems.push('test run did not succeed');
  if (report.numPendingTests + report.numTodoTests > 0 && problems.length === 0) problems.push('skipped tests present');
  return { ok: problems.length === 0 && report.numFailedTests === 0, passed: report.numPassedTests, problems };
}
