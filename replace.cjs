const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Replace state variables
content = content.replace(/const \[groups, setGroups\] = useState/g, 'const [details, setDetails] = useState');
content = content.replace(/setGroups\(/g, 'setDetails(');
content = content.replace(/groups=\{groups\}/g, 'details={details}');
content = content.replace(/groups=\[\]/g, 'details=[]');

// Replace activeGroup -> activeDetail
content = content.replace(/activeGroup/g, 'activeDetail');
content = content.replace(/setActiveGroup/g, 'setActiveDetail');

// Replace groups.map -> details.map
content = content.replace(/groups\.map/g, 'details.map');
content = content.replace(/groups\.filter/g, 'details.filter');
content = content.replace(/groups\.length/g, 'details.length');

// Replace "Grupos" -> "Detalhes"
content = content.replace(/Grupos/g, 'Detalhes');
content = content.replace(/Grupo/g, 'Detalhe');
content = content.replace(/Novo grupo/g, 'Novo detalhe');

// Replace newGroup -> newDetail
content = content.replace(/newGroup/g, 'newDetail');
content = content.replace(/setNewGroup/g, 'setNewDetail');

// Replace editingGroup -> editingDetail
content = content.replace(/editingGroup/g, 'editingDetail');
content = content.replace(/setEditingGroup/g, 'setEditingDetail');

// Replace CategoryGroupManager -> CategoryDetailManager
content = content.replace(/CategoryGroupManager/g, 'CategoryDetailManager');

// Replace groups={groups} -> details={details}
content = content.replace(/groups=\{groups\}/g, 'details={details}');

// Replace GROUPS_UPDATE -> DETAILS_UPDATE
content = content.replace(/GROUPS_UPDATE/g, 'DETAILS_UPDATE');
content = content.replace(/GROUP_ADD/g, 'DETAIL_ADD');
content = content.replace(/GROUP_EDIT/g, 'DETAIL_EDIT');
content = content.replace(/GROUP_DELETE/g, 'DETAIL_DELETE');

fs.writeFileSync('src/App.tsx', content);

// Also update types.ts
let types = fs.readFileSync('src/types.ts', 'utf8');
types = types.replace(/GROUPS_UPDATE/g, 'DETAILS_UPDATE');
types = types.replace(/GROUP_ADD/g, 'DETAIL_ADD');
types = types.replace(/GROUP_EDIT/g, 'DETAIL_EDIT');
types = types.replace(/GROUP_DELETE/g, 'DETAIL_DELETE');
fs.writeFileSync('src/types.ts', types);

// Also update server.ts
let server = fs.readFileSync('server.ts', 'utf8');
server = server.replace(/GROUPS_UPDATE/g, 'DETAILS_UPDATE');
server = server.replace(/GROUP_ADD/g, 'DETAIL_ADD');
server = server.replace(/GROUP_EDIT/g, 'DETAIL_EDIT');
server = server.replace(/GROUP_DELETE/g, 'DETAIL_DELETE');
fs.writeFileSync('server.ts', server);

console.log('Done');
