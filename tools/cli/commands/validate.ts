import fs from 'node:fs';
import path from 'node:path';
import { discoverGameProjects, loadGameProject } from '../../../pipeline/project-discovery';
import { validateGameProject } from '../../../pipeline/validators/validate-game';
import { resolveProjectAssets } from '../../../pipeline/validators/validate-assets';
import type { ValidationIssue } from '../../../pipeline/validators/validate-game';

export interface ValidateCommandOptions {
  repoRoot: string;
  projectDir?: string;
  json: boolean;
}

/**
 * `gameforge validate [projectDir]`
 *
 * Validation is also run as the first step of a build; this command exists so CI and the portal can
 * check a project *without* writing a build, which is what a "why is this broken?" answer needs.
 */
export async function runValidate(options: ValidateCommandOptions): Promise<number> {
  const projects = options.projectDir
    ? [loadGameProject(path.resolve(options.projectDir))]
    : discoverGameProjects(path.join(options.repoRoot, 'games'), {
      templatesDir: path.join(options.repoRoot, 'games', 'templates'),
    });

  if (projects.length === 0) {
    console.log('No game projects found.');
    return 0;
  }

  const results: { id: string; valid: boolean; errors: ValidationIssue[]; warnings: ValidationIssue[]; assetCount: number }[] = [];

  for (const project of projects) {
    const result = validateGameProject(project);
    const assetIssues: ValidationIssue[] = [];
    let assetCount = 0;

    if (fs.existsSync(project.entryPath)) {
      const assets = resolveProjectAssets(project.root, project.config.assets ?? []);
      assetIssues.push(...assets.issues);
      assetCount = assets.assets.length;
      for (const unmatched of assets.unmatchedAssets) {
        result.warnings.push({
          code: 'unreferenced-asset',
          severity: 'warning',
          file: unmatched,
          message: 'File matches no declared asset glob and will not ship',
        });
      }
    }

    for (const issue of assetIssues) {
      if (issue.severity === 'error') result.errors.push(issue);
      else result.warnings.push(issue);
    }

    results.push({
      id: project.config.id,
      valid: result.errors.length === 0,
      errors: result.errors,
      warnings: result.warnings,
      assetCount,
    });
  }

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    for (const result of results) {
      console.log(`[${result.valid ? 'ok  ' : 'FAIL'}] ${result.id}  (${result.assetCount} assets)`);
      for (const warning of result.warnings) console.log(`        warn ${warning.code}: ${warning.message}`);
      for (const error of result.errors) console.log(`        ERROR ${error.code}: ${error.message}`);
    }
  }

  return results.every((result) => result.valid) ? 0 : 1;
}
