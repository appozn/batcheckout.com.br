// BatCheckout — Shared Layout Builder
// Injects sidebar + topbar into any page

window.BCLayout = {
  // Build the full sidebar HTML
  sidebarHTML(activePage, pageTitle, pageSubtitle) {
    const isAdmin = BC.auth.isAdmin();
    const session = BC.auth.getSession();
    const name = session?.name || session?.email || 'Usuário';
    const email = session?.email || '';
    const initial = name[0].toUpperCase();

    const navItems = [
      { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', href: 'dashboard.html' },
      { id: 'products', label: 'Produtos', icon: 'products', href: 'products.html' },
      { id: 'checkouts', label: 'Checkouts', icon: 'checkout', href: 'checkouts.html' },
      { id: 'transactions', label: 'Transações', icon: 'transactions', href: 'transactions.html' },
      { id: 'webhooks', label: 'Webhooks', icon: 'webhooks', href: 'webhooks.html' },
      { id: 'integrations', label: 'Integrações', icon: 'integrations', href: 'integrations.html' },
      { id: 'settings', label: 'Configurações', icon: 'settings', href: 'settings.html' },
    ];

    const navItemsHTML = navItems.map(item => `
      <a class="nav-item${activePage === item.id ? ' active' : ''}" href="${item.href}">
        ${BC.icon(item.icon)}
        ${item.label}
      </a>
    `).join('');

    return `
      <div class="sidebar" id="sidebarEl">
        <div class="sidebar-logo" style="justify-content: center; padding: 16px;">
          <a href="dashboard.html"><img src="../assets/logo.png" alt="BatCheckout Logo" style="height: 85px; object-fit: contain; margin-top: 8px; margin-bottom: 8px;" /></a>
        </div>
        <nav class="sidebar-nav">
          <div class="nav-section-label">Menu</div>
          ${navItemsHTML}
          ${isAdmin ? `
          <div class="nav-section-label" style="margin-top:16px;">Administração</div>
          <a class="nav-item${activePage === 'admin' ? ' active' : ''}" href="admin.html" style="color:#FF4FA3;">
            ${BC.icon('admin')}
            Painel Admin
            <span class="nav-badge">ADM</span>
          </a>
          <a class="nav-item${activePage === 'frauds' ? ' active' : ''}" href="frauds.html" style="color:var(--danger);">
            ${BC.icon('eyeOff')}
            Fraudes
          </a>
          ` : ''}
        </nav>
        <div class="sidebar-footer">
          <div class="sidebar-user" id="userMenuBtn">
            <div class="avatar">${initial}</div>
            <div class="user-info">
              <div class="user-name">${name}</div>
              <div class="user-email">${email}</div>
            </div>
            ${BC.icon('logout', 14)}
          </div>
        </div>
      </div>
      <div class="sidebar-overlay" id="sidebarOverlay"></div>
    `;
  },

  topbarHTML(title, subtitle) {
    return `
      <div class="topbar">
        <div class="topbar-left">
          <h1>${title}</h1>
          ${subtitle ? `<p>${subtitle}</p>` : ''}
        </div>
        <div class="topbar-right">
          <div class="topbar-btn" id="notifBellBtn" title="Notificações" style="position:relative; cursor:pointer;">
            ${BC.icon('bell')}
            <div class="notif-badge">3</div>
          </div>
          <div class="topbar-btn" title="Atualizar" onclick="window.location.reload()">
            ${BC.icon('refresh')}
          </div>
        </div>
      </div>
    `;
  },

  init(activePage, title, subtitle = '') {
    if (!BC.auth.requireAuth()) return;

    document.body.innerHTML = `
      <div class="app-wrapper">
        ${BCLayout.sidebarHTML(activePage, title, subtitle)}
        <div class="main-content">
          ${BCLayout.topbarHTML(title, subtitle)}
          <div class="page-content" id="pageContent"></div>
        </div>
      </div>
      <div class="toast-container" id="toastContainer"></div>
    `;

    // Sidebar mobile toggle
    document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
      document.getElementById('sidebarEl').classList.toggle('mobile-open');
      document.getElementById('sidebarOverlay').classList.toggle('mobile-open');
    });
    document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
      document.getElementById('sidebarEl').classList.remove('mobile-open');
      document.getElementById('sidebarOverlay').classList.remove('mobile-open');
    });

    // Logout
    document.getElementById('userMenuBtn')?.addEventListener('click', () => BC.auth.logout());

    // Notification Permission
    document.getElementById('notifBellBtn')?.addEventListener('click', () => {
      if ('Notification' in window) {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            BC.toast.success('Notificações Ativadas', 'Você receberá alertas de vendas em tempo real.');
          } else if (permission === 'denied') {
            BC.toast.error('Permissão Negada', 'Habilite as notificações nas configurações do navegador.');
          }
        });
      }
    });

    // Mobile Restriction Logic
    const isMobile = window.innerWidth <= 768;
    const isAdmin = BC.auth.isAdmin();
    if (isMobile && !isAdmin) {
      if (activePage !== 'dashboard') {
        window.location.href = 'dashboard.html';
        return null;
      }
    }

    // Real-time Push Listener
    const uid = BC.auth.getCurrentUser()?.id;
    if (uid) {
      const channel = new BroadcastChannel(`notif_${uid}`);
      channel.onmessage = (event) => {
        if (event.data.type === 'push') {
          BC.toast.success(event.data.title, event.data.message);
          // Try to show browser native notification if allowed
          if ('Notification' in window && Notification.permission === 'granted') {
            try { new Notification(event.data.title, { body: event.data.message, icon: '../assets/logo.png' }); } catch (e) { }
          }
        }
      };
    }

    return document.getElementById('pageContent');
  },

  sidebar: {
    init() { /* Compatibility stub for legacy pages */ }
  }
};
