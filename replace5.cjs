const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(/Nenhum grupo com itens cadastrados\./g, 'Nenhum detalhe com itens cadastrados.');
content = content.replace(/Nenhum item nesta categoria e grupo\./g, 'Nenhum item nesta categoria e detalhe.');
content = content.replace(/Nenhum grupo com itens disponíveis\./g, 'Nenhum detalhe com itens disponíveis.');

fs.writeFileSync('src/App.tsx', content);

console.log('Done');
