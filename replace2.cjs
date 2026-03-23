const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Replace function parameters
content = content.replace(/groups = \[\]/g, 'details = []');
content = content.replace(/groups: any/g, 'details: any');

fs.writeFileSync('src/App.tsx', content);

console.log('Done');
