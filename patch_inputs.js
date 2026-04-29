const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');

    // Replace the specific problematic bg-slate-50 border-none pattern
    content = content.replace(/bg-slate-50 border-none/g, "bg-white border-2 border-slate-300 shadow-sm focus:border-primary");

    // Replace existing border border-outline with stronger border (excluding those inside tables maybe? No, tables use border-collapse)
    // Wait, some inputs have 'border border-outline'. Let's replace 'border border-outline' with 'border-2 border-slate-300' IF it's an input class
    // Instead of regex blind replacement, we can just look for 'border-outline' inside class="..." and replace it.
    // Let's just do a simpler replacement:
    content = content.replace(/border border-outline/g, "border-2 border-slate-300");
    
    // Some buttons or borders might use border border-outline, that's fine. border-2 border-slate-300 is clearer.
    
    fs.writeFileSync(file, content, 'utf8');
});

console.log('Inputs updated for clearer borders in all HTML files.');
