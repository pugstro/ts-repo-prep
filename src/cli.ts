#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { processRepo, ensureCacheUpToDate } from './index.js';
import { DetailLevel } from './types.js';

const program = new Command();

program
  .name('ts-repo-prep')
  .description('Index a TypeScript repository for AI context (SQLite backed)')
  .argument('[dir]', 'Directory to process', '.')
  .option('-o, --output <file>', 'Export the repository structure to a JSON file (optional)')
  .option('-l, --level <level>', 'Detail level for export (lite, structure, signatures, detailed)', 'detailed')
  .option('--sub-path <path>', 'Only export files within this subpath')
  .action(async (dir, options) => {
    const repoPath = path.resolve(dir);

    if (!options.output) {
      // Indexing Mode
      console.log(`Indexing repository at ${repoPath}...`);
      console.time('Indexing');
      await ensureCacheUpToDate(repoPath);
      console.timeEnd('Indexing');
      console.log('✅ Repository indexed. The SQLite database (.repo-prep.db) is ready for MCP.');
      return;
    }

    // Export Mode
    console.log(`Processing repository at ${repoPath} for export...`);
    const tree = await processRepo(repoPath, 5, options.level as DetailLevel, options.subPath);

    const outputPath = path.resolve(options.output);
    fs.writeFileSync(outputPath, JSON.stringify(tree, null, 2));
    console.log(`✅ Export saved to ${outputPath}`);
  });

program.parse(process.argv);
