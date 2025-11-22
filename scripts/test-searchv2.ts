#!/usr/bin/env bun
/**
 * Test manuel SearchToolV2
 */

import { SearchToolV2 } from '../src/tools/search-v2.js';

async function test() {
  console.log('🧪 Test SearchToolV2\n');

  const search = new SearchToolV2();

  // Test 1: Simple search
  console.log('Test 1: Search for SearchToolV2 files');
  const result1 = await search.search({
    patterns: ['**/*.ts'],
    maxResults: 5,
    scoreBy: 'fuzzy',
    query: 'search',
    returnFormat: 'paths',
  });

  console.log(`✓ Found ${result1.files.length} files:`);
  result1.files.forEach((f) => {
    console.log(`  - ${f.path} (score: ${f.score})`);
  });

  // Test 2: With snippets
  console.log('\nTest 2: With snippets and imports scoring');
  const result2 = await search.search({
    patterns: ['**/*.ts', '!**/*.spec.ts'],
    maxResults: 3,
    scoreBy: 'imports',
    query: 'SearchTool',
    returnFormat: 'snippets',
    snippetLines: 10,
  });

  console.log(`✓ Found ${result2.files.length} files with snippets:`);
  result2.files.forEach((f) => {
    console.log(
      `  - ${f.path} (score: ${f.score}, tokens: ${f.tokens})`
    );
    console.log(`    Reasons: ${f.reasons.join(', ')}`);
    if (f.snippet) {
      console.log(
        `    Snippet preview: ${f.snippet.split('\n').slice(0, 3).join('\n')}`
      );
    }
  });

  // Test 3: Modified strategy
  console.log('\nTest 3: Recently modified files');
  const result3 = await search.search({
    patterns: ['**/*.ts'],
    maxResults: 5,
    scoreBy: 'modified',
    returnFormat: 'paths',
  });

  console.log(`✓ Found ${result3.files.length} recently modified files:`);
  result3.files.forEach((f) => {
    console.log(
      `  - ${f.path} (score: ${f.score}) ${f.reasons.join(', ')}`
    );
  });

  console.log('\n✅ All tests completed!');
  console.log(`Metadata: ${JSON.stringify(result1.metadata, null, 2)}`);
}

test().catch(console.error);
