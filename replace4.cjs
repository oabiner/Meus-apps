const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /const \[newDetail, setNewDetail\] = useState\(''\);/,
  `const [newDetail, setNewDetail] = useState('');
  const [newDetailCategory, setNewDetailCategory] = useState('');`
);

content = content.replace(
  /const \[editingDetail, setEditingDetail\] = useState<any>\(null\);/,
  `const [editingDetail, setEditingDetail] = useState<any>(null);
  const [editingDetailCategory, setEditingDetailCategory] = useState('');`
);

fs.writeFileSync('src/App.tsx', content);

console.log('Done');
