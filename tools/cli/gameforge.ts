import path from 'node:path';
import { runBuild } from './commands/build';
import { runCreate } from './commands/create';
import { runDev } from './commands/dev';
import { runPreview } from './commands/preview';
import { runValidate } from './commands/validate';

const USAGE = `GameForge CLI

  gameforge build [projectDir]        Build one project, or every project under games/
  gameforge validate [projectDir]     Check configs, entry points, assets and scene references
  gameforge create <id> [options]     Scaffold a new project
  gameforge dev <projectDir>          Build, serve and rebuild on change
  gameforge preview <projectDir>      Serve an existing build

Options
  --minify / --no-minify   Minify the bundle (default: minify on build, off in dev)
  --sourcemap              Emit linked source maps
  --json                   Print machine-readable output
  --port <n>               Port for dev/preview
  --host <addr>            Bind address for dev/preview (use 0.0.0.0 to test on a phone)
  --watch / --no-watch     Watch for changes in dev (default: watch on)
  --name <text>            Display name for create
  --width <n> --height <n> Canvas size for create
  --from <dir>             Copy an existing project when creating

The repository root is taken from $GAMEFORGE_ROOT, or the current directory when unset, so the
commands are run from the repository root (as the npm scripts do).`;

interface ParsedArgs {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const [command = '', ...rest] = argv;
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }
    const [rawKey, inlineValue] = token.slice(2).split('=');
    const next = rest[index + 1];
    if (inlineValue !== undefined) {
      flags[rawKey] = inlineValue;
    } else if (next !== undefined && !next.startsWith('--')) {
      flags[rawKey] = next;
      index += 1;
    } else {
      flags[rawKey] = true;
    }
  }

  return { command, positional, flags };
}

export function resolveRepoRoot(): string {
  // Resolved from the working directory on purpose: guessing from the module location breaks as
  // soon as the CLI is bundled or run through a loader.
  return path.resolve(process.env.GAMEFORGE_ROOT ?? process.cwd());
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const { command, positional, flags } = parseArgs(argv);
  const repoRoot = resolveRepoRoot();
  const json = Boolean(flags.json);

  switch (command) {
    case 'build':
      return runBuild({
        repoRoot,
        projectDir: positional[0],
        minify: flags.minify !== undefined ? flags.minify !== false : true,
        sourcemap: Boolean(flags.sourcemap),
        json,
      });

    case 'validate':
      return runValidate({ repoRoot, projectDir: positional[0], json });

    case 'create': {
      const id = positional[0];
      if (!id) {
        console.error('gameforge create requires an id, e.g. `gameforge create my-game`');
        return 1;
      }
      return runCreate({
        repoRoot,
        id,
        name: typeof flags.name === 'string' ? flags.name : undefined,
        width: flags.width ? Number(flags.width) : undefined,
        height: flags.height ? Number(flags.height) : undefined,
        from: typeof flags.from === 'string' ? flags.from : undefined,
      });
    }

    case 'dev': {
      const projectDir = positional[0];
      if (!projectDir) {
        console.error('gameforge dev requires a project directory');
        return 1;
      }
      return runDev({
        repoRoot,
        projectDir,
        port: flags.port ? Number(flags.port) : undefined,
        host: typeof flags.host === 'string' ? flags.host : undefined,
        watch: flags.watch !== false,
      });
    }

    case 'preview': {
      const projectDir = positional[0];
      if (!projectDir) {
        console.error('gameforge preview requires a project directory');
        return 1;
      }
      return runPreview({
        repoRoot,
        projectDir,
        port: flags.port ? Number(flags.port) : undefined,
        host: typeof flags.host === 'string' ? flags.host : undefined,
      });
    }

    case 'help':
    case '--help':
    case '-h':
    case '':
      console.log(USAGE);
      return 0;

    default:
      console.error(`Unknown command "${command}".\n`);
      console.log(USAGE);
      return 1;
  }
}

/**
 * Run when invoked as a program rather than imported.
 *
 * Covers `tsx tools/cli/gameforge.ts`, the bundled `build/gameforge-cli.cjs` the desktop shell
 * spawns, and a plain node invocation - hence the .cjs in the extension list. Getting this wrong
 * fails silently (the module loads, does nothing, and exits 0), which is exactly what happened the
 * first time the shell tried to build a game.
 */
const invokedDirectly = Boolean(process.argv[1])
  && /gameforge[^\\/]*\.(?:ts|js|mjs|cjs)$/.test(process.argv[1]);
if (invokedDirectly) {
  void main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(error instanceof Error ? (error.stack ?? error.message) : error);
      process.exit(1);
    });
}
