const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const btnStart = 'const Button = React.forwardRef';
const modalEnd = 'const icons = [';

const bIndex = content.indexOf(btnStart);
const tIndex = content.indexOf(modalEnd);

if (bIndex !== -1 && tIndex !== -1) {
    const newContent = content.substring(0, bIndex) + content.substring(tIndex);
    fs.writeFileSync('src/App.tsx', newContent);
    console.log("Removed duplicate UI components.");
} else {
    console.log("Could not find blocks.");
}
