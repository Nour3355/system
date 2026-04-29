const fs = require('fs');
const path = require('path');

const files = [
  'Dashboard.html',
  'index.html',
  'Customers.html',
  'Inventory.html',
  'Suppliers.html',
  'Reports.html',
  'Settings.html'
];

const rentalLink = `
                <a href="Rentals.html" class="flex items-center rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition-all">
                    <div class="w-14 h-12 flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined">styler</span>
                    </div>
                    <span class="transition-opacity duration-300 whitespace-nowrap overflow-hidden" :class="(sidebarExpanded || sidebarLocked) ? 'opacity-100' : 'opacity-0'">التأجير</span>
                </a>`;

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    // Inject right before Customers.html link if not already there
    if (!content.includes('href="Rentals.html"')) {
      content = content.replace(/(\s*<a href="Customers\.html")/g, rentalLink + '$1');
      fs.writeFileSync(filePath, content, 'utf8');
    }
  }
});
console.log('Sidebar updated in all files.');
