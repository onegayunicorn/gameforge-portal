import fs from 'node:fs';
import path from 'node:path';
import esbuild from 'esbuild';
import { discoverGameProjects, loadGameProject, resolveGameDefaults } from './project-discovery';
import { validateGameProject } from './validators/validate-game';
import { copyPublicDir, copySceneFiles, processAssets } from './asset-pipeline';
import {
  buildGameInfo,
  generateAssetManifest,
  renderRuntimeHtml,
  writeAssetManifest,
  writeGameInfo,
  writeRuntimeHtml,
} from './manifest-generator';
import type { GameProject } from './project-discovery';
import type { ValidationIssue } from './validators/validate-game';
import type { GameBuildInfo } from './manifest-generator';

export interface BuildOptions {
  /** Project directory (the folder holding game.config.json). */
  projectDir: string;
  /** Repository root; used to find the engine source and the runtime shell. */
  repoRoot: string;
  /** Output directory. Defaults to `<projectDir>/dist`. */
  outDir?: string;
  minify?: boolean;
  sourcemap?: boolean;
  /** Engine version reported in the build report and used for the range check. */
  engineVersion?: string;
  /** Remove the output directory first (default true). */
  clean?: boolean;
  /** Optional extra gate, e.g. a browser smoke test. Called with the finished output directory. */
  smokeTest?: (outDir: string, info: GameBuildInfo) => Promise<ValidationIssue[]>;
}

export interface BuildOutput {
  /** Path relative to the output directory. */
  file: string;
  bytes: number;
  kind: 'html' | 'bundle' | 'chunk' | 'style' | 'asset' | 'manifest' | 'scene' | 'public' | 'info' | 'report';
}

export interface BuildReport {
  gameId: string;
  name: string;
  version: string;
  engineVersion: string;
  status: 'success' | 'failed';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  entry: string;
  outDir: string;
  assetCount: number;
  totalAssetBytes: number;
  outputBytes: number;
  outputs: BuildOutput[];
  bundles: { file: string; bytes: number }[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

function classifyOutput(file: string): BuildOutput['kind'] {
  if (file === 'index.html') return 'html';
  if (file === 'manifest.json') return 'manifest';
  if (file === 'game.json') return 'info';
  if (file === 'build-report.json') return 'report';
  if (file === 'runtime.css') return 'style';
  if (file.startsWith('scenes/')) return 'scene';
  if (file.startsWith('assets/')) return 'asset';
  if (file.startsWith('chunk-')) return 'chunk';
  if (file.endsWith('.js')) return 'bundle';
  return 'public';
}

function walkOutputs(outDir: string): BuildOutput[] {
  const outputs: BuildOutput[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      const relative = path.relative(outDir, full).split(path.sep).join('/');
      // Source maps are reported as part of their bundle, not as separate outputs.
      if (relative.endsWith('.map')) continue;
      outputs.push({ file: relative, bytes: fs.statSync(full).size, kind: classifyOutput(relative) });
    }
  };
  walk(outDir);
  return outputs.sort((a, b) => a.file.localeCompare(b.file));
}

/**
 * Check that a built folder is internally consistent.
 *
 * This is the pipeline's smoke test: it catches the failures that actually happen - a renamed
 * bundle, a manifest the runtime cannot parse, a missing stylesheet - without needing a browser.
 * A real browser run is layered on top by the caller via `smokeTest`.
 */
export function verifyBuildOutput(outDir: string, info: GameBuildInfo): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const required = ['index.html', 'engine.js', 'game.js', 'runtime.css', 'game.json'];

  for (const file of required) {
    if (!fs.existsSync(path.join(outDir, file))) {
      issues.push({ code: 'output-missing', severity: 'error', file, message: `Build output is missing ${file}` });
    }
  }

  const htmlPath = path.join(outDir, 'index.html');
  if (fs.existsSync(htmlPath)) {
    const html = fs.readFileSync(htmlPath, 'utf8');
    if (!html.includes('./engine.js')) {
      issues.push({ code: 'html-bundle', severity: 'error', file: 'index.html', message: 'index.html does not load ./engine.js' });
    }
    if (/\{\{[A-Z_]+\}\}/.test(html)) {
      issues.push({ code: 'html-placeholder', severity: 'error', file: 'index.html', message: 'index.html still contains unresolved placeholders' });
    }
    if (/\bhttps?:\/\//.test(html.replace(/xmlns="[^"]*"/g, ''))) {
      issues.push({ code: 'html-external', severity: 'warning', file: 'index.html', message: 'index.html references an external URL; builds are meant to be self-contained' });
    }
  }

  if (info.manifest) {
    const manifestPath = path.join(outDir, info.manifest);
    if (!fs.existsSync(manifestPath)) {
      issues.push({ code: 'manifest-missing', severity: 'error', file: info.manifest, message: 'Declared asset manifest was not written' });
    } else {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { assets?: { source?: string }[] };
        for (const asset of manifest.assets ?? []) {
          if (!asset.source) continue;
          if (!fs.existsSync(path.join(outDir, asset.source))) {
            issues.push({
              code: 'manifest-asset-missing',
              severity: 'error',
              file: asset.source,
              message: `Manifest lists ${asset.source} but the file was not copied`,
            });
          }
        }
      } catch (error) {
        issues.push({ code: 'manifest-unparseable', severity: 'error', file: info.manifest, message: `Manifest is not valid JSON: ${(error as Error).message}` });
      }
    }
  }

  return issues;
}

/**
 * Build one game into a self-contained folder.
 *
 * Steps: discover -> validate -> bundle (engine + runtime + game) -> copy and hash assets ->
 * generate manifest, shell and metadata -> verify -> write the report. A validation failure still
 * produces a report (with `status: "failed"`) so the portal can show *why* a build did not happen
 * instead of showing nothing.
 */
export async function buildGame(options: BuildOptions): Promise<{ report: BuildReport; outDir: string; info: GameBuildInfo | null }> {
  const startedAt = new Date();
  const engineVersion = options.engineVersion ?? '0.1.0';
  const project = loadGameProject(options.projectDir);
  const outDir = path.resolve(options.outDir ?? path.join(project.root, 'dist'));

  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  let info: GameBuildInfo | null = null;
  let assetCount = 0;
  let totalAssetBytes = 0;
  let bundles: { file: string; bytes: number }[] = [];

  const validation = validateGameProject(project, engineVersion);
  errors.push(...validation.errors);
  warnings.push(...validation.warnings);

  const finalise = (status: 'success' | 'failed'): BuildReport => {
    const finishedAt = new Date();
    const outputs = fs.existsSync(outDir) ? walkOutputs(outDir) : [];
    const report: BuildReport = {
      gameId: project.config.id,
      name: project.config.name,
      version: project.config.version,
      engineVersion,
      status,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      entry: project.config.entry,
      outDir: path.relative(options.repoRoot, outDir).split(path.sep).join('/'),
      assetCount,
      totalAssetBytes,
      outputBytes: outputs.reduce((total, output) => total + output.bytes, 0),
      outputs,
      bundles,
      errors,
      warnings,
    };
    if (status === 'success') {
      fs.writeFileSync(path.join(outDir, 'build-report.json'), `${JSON.stringify(report, null, 2)}\n`);
    }
    return report;
  };

  if (errors.length > 0) {
    return { report: finalise('failed'), outDir, info: null };
  }

  // Clean only after validation, so a failed validation leaves the previous build intact.
  if (options.clean ?? true) fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  try {
    // ---- bundle -----------------------------------------------------------------
    const bootstrapPath = path.join(options.repoRoot, 'runtime', 'bootstrap.ts');
    const engineSource = path.join(options.repoRoot, 'engine', 'src', 'index.ts');
    if (!fs.existsSync(bootstrapPath)) throw new Error(`Runtime shell missing at ${bootstrapPath}`);

    const buildResult = await esbuild.build({
      entryPoints: { engine: bootstrapPath, game: project.entryPath },
      outdir: outDir,
      bundle: true,
      splitting: true,
      format: 'esm',
      platform: 'browser',
      target: ['es2022'],
      sourcemap: options.sourcemap ?? false,
      minify: options.minify ?? false,
      entryNames: '[name]',
      chunkNames: 'chunk-[hash]',
      metafile: true,
      // Games and the runtime import the engine by package name; resolve it to the source so no
      // pre-build step is required and both bundles share the same engine instance.
      alias: { '@gameforge/engine': engineSource },
      loader: {
        '.png': 'file',
        '.jpg': 'file',
        '.jpeg': 'file',
        '.webp': 'file',
        '.gif': 'file',
        '.svg': 'text',
      },
      logLevel: 'silent',
      logLimit: 20,
    });

    bundles = Object.entries(buildResult.metafile.outputs)
      .filter(([file]) => file.endsWith('.js'))
      .map(([file, output]) => ({
        file: path.relative(outDir, path.resolve(options.repoRoot, file)).split(path.sep).join('/'),
        bytes: output.bytes,
      }))
      .sort((a, b) => b.bytes - a.bytes);

    // ---- assets -----------------------------------------------------------------
    const assetsResult = processAssets(project, outDir);
    assetCount = assetsResult.assets.length;
    totalAssetBytes = assetsResult.totalBytes;
    errors.push(...assetsResult.issues.filter((issue) => issue.severity === 'error'));
    warnings.push(...assetsResult.issues.filter((issue) => issue.severity === 'warning'));
    if (assetsResult.unmatchedAssets.length > 0) {
      warnings.push({
        code: 'unreferenced-assets',
        severity: 'warning',
        message: `${assetsResult.unmatchedAssets.length} asset file(s) in the project match no declared glob and will not ship: ${assetsResult.unmatchedAssets.slice(0, 5).join(', ')}`,
      });
    }

    copySceneFiles(project, outDir);
    copyPublicDir(project, outDir);

    // ---- generated files --------------------------------------------------------
    const manifestFile = assetsResult.entries.length > 0 ? 'manifest.json' : null;
    if (manifestFile) {
      writeAssetManifest(outDir, generateAssetManifest(assetsResult.entries, './'));
    }

    const defaults = resolveGameDefaults(project);
    info = buildGameInfo(project, { manifestFileName: manifestFile, entry: './game.js' });
    writeGameInfo(outDir, info);

    const templatePath = path.join(options.repoRoot, 'runtime', 'index.html');
    writeRuntimeHtml(outDir, renderRuntimeHtml(project, { templatePath }));

    const runtimeCss = path.join(options.repoRoot, 'runtime', 'runtime.css');
    if (fs.existsSync(runtimeCss)) fs.copyFileSync(runtimeCss, path.join(outDir, 'runtime.css'));

    if (defaults.renderer === 'webgl2') {
      warnings.push({
        code: 'renderer-degraded',
        severity: 'warning',
        message: 'Requested webgl2; the runtime will use canvas2d until milestone 2 lands',
      });
    }

    // ---- verify -----------------------------------------------------------------
    const verifyIssues = verifyBuildOutput(outDir, info);
    errors.push(...verifyIssues.filter((issue) => issue.severity === 'error'));
    warnings.push(...verifyIssues.filter((issue) => issue.severity === 'warning'));

    if (options.smokeTest && errors.length === 0) {
      const smokeIssues = await options.smokeTest(outDir, info);
      errors.push(...smokeIssues.filter((issue) => issue.severity === 'error'));
      warnings.push(...smokeIssues.filter((issue) => issue.severity === 'warning'));
    }

    return { report: finalise(errors.length > 0 ? 'failed' : 'success'), outDir, info };
  } catch (error) {
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    errors.push({ code: 'build-exception', severity: 'error', message });
    return { report: finalise('failed'), outDir, info };
  }
}

export interface BuildAllOptions {
  repoRoot: string;
  /** Root to scan for projects. Defaults to `<repoRoot>/games`. */
  gamesRoot?: string;
  includeTemplates?: boolean;
  minify?: boolean;
  engineVersion?: string;
}

/** Build every discovered project. One failure does not stop the others. */
export async function buildAllGames(options: BuildAllOptions): Promise<{ reports: BuildReport[]; projects: GameProject[] }> {
  const gamesRoot = path.resolve(options.gamesRoot ?? path.join(options.repoRoot, 'games'));
  const projects = discoverGameProjects(gamesRoot, {
    templatesDir: path.join(gamesRoot, 'templates'),
    includeTemplates: options.includeTemplates ?? false,
  });

  const reports: BuildReport[] = [];
  for (const project of projects) {
    const { report } = await buildGame({
      projectDir: project.root,
      repoRoot: options.repoRoot,
      minify: options.minify ?? true,
      engineVersion: options.engineVersion,
    });
    reports.push(report);
  }
  return { reports, projects };
}
