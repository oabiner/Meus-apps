const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

const startIndex = content.indexOf('const MenuTab = React.memo');
const endIndex = content.indexOf('const StockTab = React.memo');

if (startIndex !== -1 && endIndex !== -1) {
    const chunk = content.substring(startIndex, endIndex);
    
    // Create new file MenuTab.tsx
    const imports = `import React, { useState } from 'react';\nimport { Search, Plus, ArrowLeft, Tags, Pencil, Trash2, Power, PowerOff } from 'lucide-react';\nimport { Button, Input, Modal, ConfirmModal, cn } from './ui';\n\nconst formatCurrency = (value: number) => {\n  return new Intl.NumberFormat('pt-BR', {\n    style: 'currency',\n    currency: 'BRL',\n    minimumFractionDigits: 2,\n    maximumFractionDigits: 2\n  }).format(Math.round((value || 0) * 100) / 100);\n};\n\nexport ` + chunk;
    
    fs.writeFileSync('src/components/MenuTab.tsx', imports);
    
    // Remove from App.tsx
    let newContent = content.substring(0, startIndex) + content.substring(endIndex);
    
    // Add import statement at top
    const importStatement = "import { MenuTab } from './components/MenuTab';\n";
    const splitIndex = newContent.indexOf('import { TableManagement }');
    if (splitIndex !== -1) {
       newContent = newContent.substring(0, splitIndex) + importStatement + newContent.substring(splitIndex);
    } else {
       newContent = importStatement + newContent;
    }
    
    fs.writeFileSync('src/App.tsx', newContent);
    console.log("Extracted MenuTab successfully.");
} else {
    console.log("Could not find MenuTab bounds.");
}
