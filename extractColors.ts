// extractColors.ts
const fs = require('fs');
const path = require('path');

const filePath = path.resolve('./assets/data/arenas.json');
const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const teams = new Set();
const colorCodes = new Set();

for (const arena of jsonData) {
  if (arena.teamName) teams.add(arena.teamName);
  if (arena.colorCode) colorCodes.add(arena.colorCode.trim());
}

console.log(`Number of unique teams: ${teams.size}`);
console.log(`Number of unique colorCodes: ${colorCodes.size}`);
console.log('\nAll color codes:');
console.log([...colorCodes]);