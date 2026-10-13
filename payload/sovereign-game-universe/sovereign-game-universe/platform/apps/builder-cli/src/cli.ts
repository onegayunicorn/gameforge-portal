#!/usr/bin/env node
/** ugb — Universal Game Builder CLI */
const VERSION = '1.0.0';
const COMMANDS = [
  'init <name> [--template]', 'doctor', 'engines list', 'engines detect',
  'project validate', 'assets import <path>', 'assets optimize', 'scene validate',
  'build --target <target>', 'run --target <target>', 'test', 'package',
  'deploy staging', 'deploy production', 'rollback'
];
const args = process.argv.slice(2);
if (args.length === 0 || args[0] === '--help') {
  console.log(`ugb v${VERSION}\nCommands:`);
  COMMANDS.forEach(c => console.log(`  ugb ${c}`));
  process.exit(0);
}
console.log(`[ugb] ${args.join(' ')}`);
