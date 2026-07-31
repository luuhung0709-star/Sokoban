// Generates web/src/levels/microban.json from the microban.txt next to this script.
// Run by hand when changing the level set:  node tools/import-microban.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseMicroban } from '../src/levels/parseMicroban.js';
import { validateLevel } from '../src/levels/levelValidator.js';

const SOURCE = fileURLToPath(new URL('./microban.txt', import.meta.url));
const OUTPUT = fileURLToPath(new URL('../src/levels/microban.json', import.meta.url));

const { levels, errors } = parseMicroban(readFileSync(SOURCE, 'utf8'));

for (const error of errors) console.error(`Parse error: ${error}`);

let invalid = 0;
levels.forEach((level, index) => {
  const issues = validateLevel(level);
  for (const issue of issues) {
    console.error(`Level ${index} ("${level.name}"): ${issue}`);
    invalid++;
  }
});

if (errors.length > 0 || invalid > 0) {
  // Writing out a set with a broken level means the error blows up during play,
  // far from what caused it.
  console.error(`\nStopping: ${errors.length} parse error(s), ${invalid} invalid level(s).`);
  process.exit(1);
}

writeFileSync(OUTPUT, `${JSON.stringify({ collectionName: 'Microban', levels }, null, 1)}\n`, 'utf8');
console.log(`Wrote ${levels.length} levels to ${OUTPUT}`);
