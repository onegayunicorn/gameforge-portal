import fs from 'node:fs';
import path from 'node:path';
import { resolveProjectPath } from './project-paths';

/** Fields the pipeline understands. Mirrors tools/schemas/game-config.schema.json. */
export interface GameConfig {
  $schema?: string;
  id: string;
  name: string;
  description?: string;
  version: string;
  engine?: string;
  entry: string;
  type?: '2d';
  renderer?: 'auto' | 'canvas2d' | 'webgl2';
  width?: number;
  height?: number;
  fixedTimeStep?: number;
  clearColor?: string;
  pixelArt?: boolean;
  debug?: boolean;
  scenes?: string[];
  assets?: string[];
  scripts?: Record<string, string>;
  tags?: string[];
}

export interface GameProject {
  /** Absolute path to the project directory (the folder holding game.config.json). */
  root: string;
  /** Project directory name, used as a fallback id. */
  folderName: string;
  /** Absolute path to game.config.json. */
  configPath: string;
  /** Absolute path to the entry module. */
  entryPath: string;
  config: GameConfig;
  /** True when the project lives under games/templates: valid, but not meant to be built. */
  isTemplate: boolean;
}

export const GAME_CONFIG_FILENAME = 'game.config.json';

export class ProjectError extends Error {
  constructor(message: string, readonly projectPath: string) {
    super(message);
    this.name = 'ProjectError';
  }
}

function readJsonFile(filePath: string): unknown {
  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new ProjectError(`Invalid JSON in ${filePath}: ${(error as Error).message}`, filePath);
  }
}

const REQUIRED_FIELDS: (keyof GameConfig)[] = ['id', 'name', 'version', 'entry'];
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}$/;

/**
 * Runtime shape checks.
 *
 * These are deliberately duplicated from the JSON schema: the schema gives editors completion,
 * while this runs in CI and in the CLI where a schema validator would be an extra dependency for a
 * handful of rules.
 */
export function validateConfigShape(config: unknown, projectPath: string): string[] {
  const problems: string[] = [];
  if (typeof config !== 'object' || config === null) return ['configuration must be a JSON object'];

  const candidate = config as Partial<GameConfig>;
  for (const field of REQUIRED_FIELDS) {
    const value = candidate[field];
    if (value === undefined || value === null || value === '') problems.push(`"${field}" is required`);
    else if (typeof value !== 'string') problems.push(`"${field}" must be a string`);
  }

  if (typeof candidate.id === 'string' && !ID_PATTERN.test(candidate.id)) {
    problems.push('"id" must be lowercase kebab-case starting with a letter or digit (2-63 characters)');
  }
  if (typeof candidate.version === 'string' && !/^\d+\.\d+\.\d+/.test(candidate.version)) {
    problems.push('"version" must be a semantic version such as 0.1.0');
  }
  if (candidate.renderer !== undefined && !['auto', 'canvas2d', 'webgl2'].includes(candidate.renderer)) {
    problems.push('"renderer" must be one of auto, canvas2d, webgl2');
  }
  for (const dimension of ['width', 'height'] as const) {
    const value = candidate[dimension];
    if (value !== undefined && (!Number.isInteger(value) || value < 64 || value > 7680)) {
      problems.push(`"${dimension}" must be an integer between 64 and 7680`);
    }
  }
  if (candidate.scenes !== undefined && !Array.isArray(candidate.scenes)) {
    problems.push('"scenes" must be an array of paths');
  }
  if (candidate.assets !== undefined && !Array.isArray(candidate.assets)) {
    problems.push('"assets" must be an array of glob patterns');
  }
  void projectPath;
  return problems;
}

/** Load one project from a directory containing game.config.json. */
export function loadGameProject(projectDir: string, options: { templatesDir?: string } = {}): GameProject {
  const root = path.resolve(projectDir);
  const configPath = path.join(root, GAME_CONFIG_FILENAME);

  if (!fs.existsSync(configPath)) {
    throw new ProjectError(`No ${GAME_CONFIG_FILENAME} in ${root}`, root);
  }

  const config = readJsonFile(configPath) as GameConfig;
  const problems = validateConfigShape(config, root);
  if (problems.length > 0) {
    throw new ProjectError(`${configPath} is not valid:\n  - ${problems.join('\n  - ')}`, root);
  }

  let entryPath: string;
  try {
    entryPath = resolveProjectPath(root, config.entry, 'entry');
  } catch (error) {
    throw new ProjectError((error as Error).message, root);
  }
  for (const [index, scene] of (config.scenes ?? []).entries()) {
    if (typeof scene !== 'string') {
      throw new ProjectError(`scenes[${index}] must be a relative path`, root);
    }
    try {
      resolveProjectPath(root, scene, `scenes[${index}]`);
    } catch (error) {
      throw new ProjectError((error as Error).message, root);
    }
  }
  const relativeToTemplates = options.templatesDir
    ? path.relative(path.resolve(options.templatesDir), root)
    : '';
  const isTemplate = relativeToTemplates !== '' && !relativeToTemplates.startsWith('..') && !path.isAbsolute(relativeToTemplates);

  return {
    root,
    folderName: path.basename(root),
    configPath,
    entryPath,
    config,
    isTemplate,
  };
}

export interface DiscoverOptions {
  /** Directory holding the templates, excluded from builds by default. */
  templatesDir?: string;
  /** Include template projects in the result. */
  includeTemplates?: boolean;
  /** Directory names never scanned. */
  ignoreDirs?: string[];
}

/** Find every game project under `root`, sorted by id for stable build output. */
export function discoverGameProjects(root: string, options: DiscoverOptions = {}): GameProject[] {
  const absoluteRoot = path.resolve(root);
  const ignore = new Set(options.ignoreDirs ?? ['node_modules', 'dist', '.git', 'assets', 'src']);
  const projects: GameProject[] = [];

  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    // A directory with a config is a project root: do not descend further looking for more.
    if (entries.some((entry) => entry.isFile() && entry.name === GAME_CONFIG_FILENAME)) {
      try {
        const project = loadGameProject(dir, { templatesDir: options.templatesDir });
        if (!project.isTemplate || options.includeTemplates) projects.push(project);
      } catch (error) {
        // A broken project is reported by the caller through validate; discovery stays resilient.
        if (process.env.GAMEFORGE_DEBUG) console.warn(String(error));
      }
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || ignore.has(entry.name) || entry.name.startsWith('.')) continue;
      walk(path.join(dir, entry.name));
    }
  };

  walk(absoluteRoot);
  return projects.sort((a, b) => a.config.id.localeCompare(b.config.id));
}

/** Effective values after defaults, so callers never repeat the fallbacks. */
export function resolveGameDefaults(project: GameProject): {
  width: number;
  height: number;
  clearColor: string;
  renderer: 'auto' | 'canvas2d' | 'webgl2';
  fixedTimeStep: number;
  type: '2d';
  engine: string;
} {
  const { config } = project;
  return {
    width: config.width ?? 1280,
    height: config.height ?? 720,
    clearColor: config.clearColor ?? '#0b1020',
    renderer: config.renderer ?? 'auto',
    fixedTimeStep: config.fixedTimeStep ?? 1 / 60,
    type: config.type ?? '2d',
    engine: config.engine ?? '^0.1.0',
  };
}
