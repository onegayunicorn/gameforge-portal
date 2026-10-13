#!/usr/bin/env node
"use strict";
/**
 * ugb — Universal Game Builder CLI
 * Usage: ugb <command> [options]
 */
const VERSION = '1.0.0';
const commands = [
    'init', 'game validate', 'game inspect', 'game capabilities',
    'toolchains detect', 'devkits detect',
    'assets scan', 'assets validate', 'assets optimize', 'assets manifest',
    'shaders validate', 'shaders compile', 'content validate',
    'configure', 'build', 'test', 'test:unit', 'test:integration', 'test:game',
    'test:e2e', 'test:visual', 'test:performance', 'test:security',
    'package', 'checksums', 'sbom', 'provenance',
    'deploy staging', 'deploy production', 'rollback'
];
const args = process.argv.slice(2);
if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`ugb v${VERSION} — Universal Game Builder`);
    console.log('Commands:');
    commands.forEach(c => console.log(`  ugb ${c}`));
    process.exit(0);
}
if (args[0] === '--version' || args[0] === '-v') {
    console.log(VERSION);
    process.exit(0);
}
console.log(`[ugb] ${args.join(' ')} — (stub, implement in build-graph package)`);
