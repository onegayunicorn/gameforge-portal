/**
 * Programmatic CLI surface.
 *
 * The portal's Electron main process imports these commands rather than shelling out, so a build
 * triggered from the UI uses exactly the same code path (and the same validation) as the terminal.
 */
export { main, parseArgs, resolveRepoRoot } from './gameforge';
export { runBuild } from './commands/build';
export type { BuildCommandOptions } from './commands/build';
export { runValidate } from './commands/validate';
export type { ValidateCommandOptions } from './commands/validate';
export { runCreate } from './commands/create';
export type { CreateCommandOptions } from './commands/create';
export { runPreview, serveDirectory, lanAddresses } from './commands/preview';
export type { PreviewCommandOptions, ServeHandle, ServeOptions } from './commands/preview';
export { runDev } from './commands/dev';
export type { DevCommandOptions } from './commands/dev';
