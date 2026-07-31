// Sinh web/src/levels/microban.json từ microban.txt nằm cạnh script này.
// Chạy tay khi đổi bộ màn:  node tools/import-microban.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseMicroban } from '../src/levels/parseMicroban.js';
import { validateLevel } from '../src/levels/levelValidator.js';

const SOURCE = fileURLToPath(new URL('./microban.txt', import.meta.url));
const OUTPUT = fileURLToPath(new URL('../src/levels/microban.json', import.meta.url));

const { levels, errors } = parseMicroban(readFileSync(SOURCE, 'utf8'));

for (const error of errors) console.error(`Lỗi parse: ${error}`);

let invalid = 0;
levels.forEach((level, index) => {
  const issues = validateLevel(level);
  for (const issue of issues) {
    console.error(`Màn ${index} ("${level.name}"): ${issue}`);
    invalid++;
  }
});

if (errors.length > 0 || invalid > 0) {
  // Ghi ra một bộ màn có màn hỏng thì lỗi sẽ nổ lúc chơi, xa chỗ gây ra nó.
  console.error(`\nDừng lại: ${errors.length} lỗi parse, ${invalid} màn không hợp lệ.`);
  process.exit(1);
}

writeFileSync(OUTPUT, `${JSON.stringify({ collectionName: 'Microban', levels }, null, 1)}\n`, 'utf8');
console.log(`Đã ghi ${levels.length} màn vào ${OUTPUT}`);
