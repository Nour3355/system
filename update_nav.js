const fs = require('fs');

const newNav = `
            <div class="py-6 px-5 flex items-center justify-between overflow-hidden">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 shrink-0 rounded-xl bg-accent flex items-center justify-center shadow-lg shadow-accent/20">
                        <span class="material-symbols-outlined text-white font-bold text-lg">shopping_bag</span>
                    </div>
                    <h1 class="text-xl font-extrabold tracking-tight transition-opacity duration-300 whitespace-nowrap" :class="(sidebarExpanded || sidebarLocked) ? 'opacity-100' : 'opacity-0'">براند</h1>
                </div>
                <button @click="sidebarLocked = !sidebarLocked; localStorage.setItem('sidebarLocked', sidebarLocked)" 
                        class="transition-all duration-300 hover:bg-white/10 p-2 rounded-lg"
                        :class="(sidebarExpanded || sidebarLocked) ? 'opacity-100' : 'opacity-0 pointer-events-none'">
                    <span class="material-symbols-outlined text-sm" :style="sidebarLocked ? 'font-variation-settings: \\'FILL\\' 1' : ''">push_pin</span>
                </button>
            </div>

            <nav class="mt-4 px-3 flex flex-col gap-2 flex-1">
                <a href="Dashboard.html" class="nav-link flex items-center rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition-all">
                    <div class="w-14 h-12 flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined">dashboard</span>
                    </div>
                    <span class="transition-opacity duration-300 whitespace-nowrap overflow-hidden" :class="(sidebarExpanded || sidebarLocked) ? 'opacity-100' : 'opacity-0'">لوحة التحكم</span>
                </a>
                <a href="index.html" class="nav-link flex items-center rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition-all">
                    <div class="w-14 h-12 flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined">point_of_sale</span>
                    </div>
                    <span class="transition-opacity duration-300 whitespace-nowrap overflow-hidden" :class="(sidebarExpanded || sidebarLocked) ? 'opacity-100' : 'opacity-0'">الكاشير</span>
                </a>
                <a href="Rentals.html" class="nav-link flex items-center rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition-all">
                    <div class="w-14 h-12 flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined">styler</span>
                    </div>
                    <span class="transition-opacity duration-300 whitespace-nowrap overflow-hidden" :class="(sidebarExpanded || sidebarLocked) ? 'opacity-100' : 'opacity-0'">التأجير</span>
                </a>
                <a href="Customers.html" class="nav-link flex items-center rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition-all">
                    <div class="w-14 h-12 flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined">group</span>
                    </div>
                    <span class="transition-opacity duration-300 whitespace-nowrap overflow-hidden" :class="(sidebarExpanded || sidebarLocked) ? 'opacity-100' : 'opacity-0'">العملاء</span>
                </a>
                <a href="Inventory.html" class="nav-link flex items-center rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition-all">
                    <div class="w-14 h-12 flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined">inventory_2</span>
                    </div>
                    <span class="transition-opacity duration-300 whitespace-nowrap overflow-hidden" :class="(sidebarExpanded || sidebarLocked) ? 'opacity-100' : 'opacity-0'">المخزون</span>
                </a>
                <a href="Suppliers.html" class="nav-link flex items-center rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition-all">
                    <div class="w-14 h-12 flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined">local_shipping</span>
                    </div>
                    <span class="transition-opacity duration-300 whitespace-nowrap overflow-hidden" :class="(sidebarExpanded || sidebarLocked) ? 'opacity-100' : 'opacity-0'">الموردين</span>
                </a>
                <a href="Employees.html" class="nav-link flex items-center rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition-all">
                    <div class="w-14 h-12 flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined">badge</span>
                    </div>
                    <span class="transition-opacity duration-300 whitespace-nowrap overflow-hidden" :class="(sidebarExpanded || sidebarLocked) ? 'opacity-100' : 'opacity-0'">الموظفين</span>
                </a>
                <a href="Expenses.html" class="nav-link flex items-center rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition-all">
                    <div class="w-14 h-12 flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined">receipt_long</span>
                    </div>
                    <span class="transition-opacity duration-300 whitespace-nowrap overflow-hidden" :class="(sidebarExpanded || sidebarLocked) ? 'opacity-100' : 'opacity-0'">المصاريف</span>
                </a>
                <a href="Reports.html" class="nav-link flex items-center rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition-all">
                    <div class="w-14 h-12 flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined">bar_chart</span>
                    </div>
                    <span class="transition-opacity duration-300 whitespace-nowrap overflow-hidden" :class="(sidebarExpanded || sidebarLocked) ? 'opacity-100' : 'opacity-0'">التقارير</span>
                </a>
                <a href="Settings.html" class="nav-link flex items-center rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition-all">
                    <div class="w-14 h-12 flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined">settings</span>
                    </div>
                    <span class="transition-opacity duration-300 whitespace-nowrap overflow-hidden" :class="(sidebarExpanded || sidebarLocked) ? 'opacity-100' : 'opacity-0'">الإعدادات</span>
                </a>
            </nav>

            <div class="p-3 mt-auto border-t border-white/10">
                <button onclick="logout()" class="w-full flex items-center rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all">
                    <div class="w-14 h-12 flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined">logout</span>
                    </div>
                    <span class="transition-opacity duration-300 whitespace-nowrap overflow-hidden" :class="(sidebarExpanded || sidebarLocked) ? 'opacity-100' : 'opacity-0'">تسجيل الخروج</span>
                </button>
            </div>
`;

const files = fs.readdirSync('.').filter(file => file.endsWith('.html') && file !== 'login.html');

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');

    // Replace sidebar
    const startMarker = '<aside';
    const endMarker = '</aside>';
    const startIndex = content.indexOf(startMarker);
    const endIndex = content.indexOf(endMarker);

    if (startIndex !== -1 && endIndex !== -1) {
        // Keep the opening <aside ...> tag
        const asideOpenTagEnd = content.indexOf('>', startIndex) + 1;
        
        const before = content.substring(0, asideOpenTagEnd);
        const after = content.substring(endIndex);

        // Set active state
        let injectedNav = newNav;
        const basename = file;
        const oldLink = '<a href="' + basename + '" class="nav-link flex items-center rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition-all">';
        const activeLink = '<a href="' + basename + '" class="nav-link flex items-center rounded-xl bg-white/10 text-white font-medium transition-all">';
        injectedNav = injectedNav.split(oldLink).join(activeLink);

        content = before + injectedNav + after;
        
        // Add auth.js script if not exists
        if (!content.includes('auth.js')) {
            content = content.replace('</head>', '    <script src="auth.js"></script>\n</head>');
        }

        fs.writeFileSync(file, content, 'utf8');
        console.log("Updated sidebar and injected auth in " + file);
    }
});
