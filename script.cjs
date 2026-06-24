const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

const importStatement = "import { AccountsPayableSection, FinanceSection } from './components/FinanceComponents';\n";

const accountsStartIndex = content.indexOf('function AccountsPayableSection');
if (accountsStartIndex !== -1) {
    let newContent = content.substring(0, accountsStartIndex);
    const splitIndex = newContent.indexOf('import { TableManagement } from');
    if (splitIndex !== -1) {
       newContent = newContent.substring(0, splitIndex) + importStatement + newContent.substring(splitIndex);
    } else {
       newContent = importStatement + newContent;
    }
    fs.writeFileSync('src/App.tsx', newContent);
    console.log("Replaced massive blocks successfully.");
} else {
    console.log("Could not find start.");
}
