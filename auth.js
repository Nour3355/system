// Fetch user data on every page load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('/api/me');
        if (!res.ok) {
            if (window.location.pathname !== '/login.html') {
                window.location.href = '/login.html';
            }
            return;
        }
        
        const data = await res.json();
        const user = data.user;
        window.currentUser = user;

        // Render user info
        const userInfoContainer = document.getElementById('user-info-display');
        if (userInfoContainer) {
            userInfoContainer.innerHTML = `
                <div class="text-left hidden sm:block">
                    <p class="text-xs font-bold text-primary">${user.username}</p>
                    <p class="text-[10px] text-slate-400 font-medium">${user.role === 'admin' ? 'مدير النظام' : 'موظف فرع'}</p>
                </div>
                <div class="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-lg shadow-sm">
                    ${user.username.charAt(0).toUpperCase()}
                </div>
            `;
        }

        // Ensure user has a permissions array, fallback if null
        const userPermissions = user.permissions || ['Dashboard.html', 'index.html', 'Rentals.html', 'Customers.html', 'Inventory.html'];

        // If user is not admin, enforce permissions
        if (user && user.role !== 'admin') {
            // Remove restricted links from sidebar
            const navLinks = document.querySelectorAll('aside nav a');
            navLinks.forEach(link => {
                const href = link.getAttribute('href');
                if (!userPermissions.includes(href)) {
                    link.style.display = 'none';
                }
            });

            // If user tries to access restricted page directly, redirect
            const currentPage = window.location.pathname.split('/').pop() || 'index.html';
            if (!userPermissions.includes(currentPage) && currentPage !== 'login.html') {
                // Find first available page to redirect to
                if (userPermissions.length > 0) {
                    window.location.href = '/' + userPermissions[0];
                } else {
                    alert('ليس لديك أي صلاحيات لفتح هذا النظام');
                    window.logout();
                }
            }
        }
        // Update Store Name Globally
        try {
            const settingsRes = await fetch('/api/settings');
            const settings = await settingsRes.json();
            if (settings.store_name) {
                // Update Sidebar Logo Text
                const logoTitle = document.querySelector('aside h1');
                if (logoTitle) logoTitle.textContent = settings.store_name;

                // Update Login Page Title
                const loginTitle = document.querySelector('.login-brand-title');
                if (loginTitle) loginTitle.textContent = settings.store_name;

                // Update Window Title
                if (document.title.includes('براند')) {
                    document.title = document.title.replace('براند', settings.store_name);
                }
                
                // Store in window for other scripts to use
                window.storeSettings = settings;
            }
        } catch (sErr) {
            console.error('Settings load error:', sErr);
        }
    } catch (err) {
        console.error('Auth error:', err);
    }
});

// Logout function attached to window
window.logout = async function() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/login.html';
    } catch (err) {
        console.error(err);
    }
};
