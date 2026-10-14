import fs from 'node:fs';
import path from 'node:path';
import { resolveGameDefaults } from '../project-discovery';
import { resolveProjectPath } from '../project-paths';
import type { GameProject } from '../project-discovery';

export interface ValidationIssue {
  /** Machine-readable code so the portal and CI can group problems. */
  code: string;
  message: string;
  /** Path the issue relates to, relative to the project root when possible. */
  file?: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

const ENTRY_EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.jsx'];

/** Version range check that understands the `^` and `~` forms used in game.config.json. */
export function satisfiesEngineRange(range: string, engineVersion: string): boolean {
  const parse = (value: string) => value.replace(/^[\^~]/, '').split('.').map((part) => Number.parseInt(part, 10));
  const [rangeMajor = 0] = parse(range);
  const [engineMajor = 0] = parse(engineVersion);
  if (range.startsWith('^')) return engineMajor === rangeMajor;
  if (range.startsWith('~')) return engineMajor === rangeMajor;
  return engineVersion === range;
}

/**
 * Validate a project before building.
 *
 * Errors stop the build; warnings do not. The split matters because a missing asset glob is a
 * legitimate state for a code-only project, whereas a missing entry point never is.
 */
export function validateGameProject(project: GameProject, engineVersion: string = '0.1.0'): ValidationResult {
  // Collected without a severity and stamped on the way out, so each call site cannot forget it.
  const errors: Omit<ValidationIssue, 'severity'>[] = [];
  const warnings: Omit<ValidationIssue, 'severity'>[] = [];
  const { config } = project;

  if (!fs.existsSync(project.entryPath)) {
    errors.push({
      code: 'entry-missing',
      message: `Entry module not found: ${config.entry}`,
      file: config.entry,
    });
  } else {
    const extension = path.extname(project.entryPath);
    if (!ENTRY_EXTENSIONS.includes(extension)) {
      errors.push({
        code: 'entry-extension',
        message: `Entry must be one of ${ENTRY_EXTENSIONS.join(', ')} (found ${extension || 'no extension'})`,
        file: config.entry,
      });
    }
    const source = fs.readFileSync(project.entryPath, 'utf8');
    if (!/export\s+(?:async\s+)?function\s+(setup|createGame)/.test(source) && !/export\s+default/.test(source)) {
      warnings.push({
        code: 'entry-shape',
        message: 'Entry exports neither `setup(engine)` nor a default export; the runtime will report "not a game"',
        file: config.entry,
      });
    }
  }

  const defaults = resolveGameDefaults(project);
  if (defaults.renderer === 'webgl2') {
    warnings.push({
      code: 'renderer-webgl2',
      message: 'renderer "webgl2" is not implemented yet (milestone 2); the build will fall back to canvas2d at runtime',
    });
  }

  const range = defaults.engine;
  if (!satisfiesEngineRange(range, engineVersion)) {
    warnings.push({
      code: 'engine-range',
      message: `Game targets engine ${range} but the installed engine is ${engineVersion}`,
    });
  }

  for (const scene of config.scenes ?? []) {
    try {
      if (!fs.existsSync(resolveProjectPath(project.root, scene, 'scene'))) {
        errors.push({ code: 'scene-missing', message: `Scene file not found: ${scene}`, file: scene });
      }
    } catch (error) {
      errors.push({ code: 'scene-outside-project', message: (error as Error).message, file: scene });
    }
  }

  if ((config.assets ?? []).length === 0) {
    warnings.push({
      code: 'no-assets',
      message: 'No asset globs declared; the build will ship code only',
    });
  }

  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(config.id)) {
    errors.push({ code: 'id-format', message: `Game id "${config.id}" is not lowercase kebab-case` });
  }

  return {
    valid: errors.length === 0,
    errors: errors.map((issue) => ({ ...issue, severity: 'error' as const })),
    warnings: warnings.map((issue) => ({ ...issue, severity: 'warning' as const })),
  };
}
