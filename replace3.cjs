const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(/matchesGroup/g, 'matchesDetail');
content = content.replace(/groupItems/g, 'detailItems');
content = content.replace(/\{\/\* Groups \*\/\}/g, '{/* Detalhes */}');

fs.writeFileSync('src/App.tsx', content);

console.log('Done');
