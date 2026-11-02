#!/usr/bin/env node
/** Start the read-only portal on every network interface so other users can open it. */
process.env.HOST = process.env.HOST || '0.0.0.0';
process.env.PORT = process.env.PORT || '4173';
require('./serve.js');
