import path from 'node:path';
import { buildAllGames, buildGame } from '../../../pipeline/game-builder';
import type { BuildReport } from '../../../pipeline/game-builder';

export interface BuildCommandOptions {
  repoRoot: string;
  /** Project dir, or undefined to build every discovered project. */
  projectDir?: string;
  minify: boolean;
  sourcemap: boolean;
  json: boolean;
}

function printReport(report: BuildReport): void {
  const status = report.status === 'success' ? 'ok  ' : 'FAIL';
  console.log(`[${status}] ${report.gameId}  ${report.outputs.length} files  ${(report.outputBytes / 1024).toFixed(1)} KB  ${report.durationMs}ms`);
  if (report.bundles.length > 0) {
    console.log(`        bundles: ${report.bundles.map((bundle) => `${bundle.file} ${(bundle.bytes / 1024).toFixed(1)} KB`).join(', ')}`);
  }
  if (report.assetCount > 0) {
    console.log(`        assets: ${report.assetCount} files, ${(report.totalAssetBytes / 1024).toFixed(1)} KB (hashed)`);
  }
  for (const warning of report.warnings) {
    console.log(`        warn ${warning.code}: ${warning.message}`);
  }
  for (const error of report.errors) {
    console.log(`        ERROR ${error.code}: ${error.message}`);
  }
}

/** `gameforge build [projectDir]` - build one project, or all of them when none is given. */
export async function runBuild(options: BuildCommandOptions): Promise<number> {
  if (options.projectDir) {
    const { report } = await buildGame({
      projectDir: path.resolve(options.projectDir),
      repoRoot: options.repoRoot,
      minify: options.minify,
      sourcemap: options.sourcemap,
    });
    if (options.json) console.log(JSON.stringify(report, null, 2));
    else printReport(report);
    return report.status === 'success' ? 0 : 1;
  }

  const { reports } = await buildAllGames({ repoRoot: options.repoRoot, minify: options.minify });
  if (options.json) {
    console.log(JSON.stringify(reports, null, 2));
  } else {
    if (reports.length === 0) {
      console.log('No game projects found under games/.');
      return 0;
    }
    for (const report of reports) printReport(report);
  }
  return reports.every((report) => report.status === 'success') ? 0 : 1;
}
