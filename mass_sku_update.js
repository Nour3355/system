const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    // Specifically targeted labels and placeholders
    if (content.includes('كود المنتج')) {
        content = content.replace(/كود المنتج/g, 'SKU');
        changed = true;
    }
    if (content.includes('الكود')) {
        content = content.replace(/الكود/g, 'SKU');
        changed = true;
    }
    if (content.includes('كود:')) {
        content = content.replace(/كود:/g, 'SKU:');
        changed = true;
    }
    
    // Check for any remaining Arabic "كود" followed by space or end of tag
    // but be careful with words like "كودات" or "كودين" (rare in this app)
    // Actually, most labels are "الكود" or "كود"
    
    if (changed) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated ${file}`);
    }
});
