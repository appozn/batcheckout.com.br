// BatCheckout — Shared Utilities & Data Layer
// Uses localStorage as the database layer (no Node.js required)

const BC = {
  // ===================================================================
  // STORAGE HELPERS
  // ===================================================================
  storage: {
    get(key, fallback = null) {
      try { const v = localStorage.getItem(`bat_${key}`); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(`bat_${key}`, JSON.stringify(value)); } catch { }
    },
    remove(key) { localStorage.removeItem(`bat_${key}`); },
    clear() { Object.keys(localStorage).filter(k => k.startsWith('bat_')).forEach(k => localStorage.removeItem(k)); },
  },

  // ===================================================================
  // AUTH
  // ===================================================================
  auth: {
    ADMIN_EMAIL: 'bat.adm@adm.com',
    ADMIN_PASSWORD: 'batcheckout.adm',

    getSession() { return BC.storage.get('session'); },
    isLoggedIn() { return !!BC.auth.getSession(); },
    isAdmin() { const s = BC.auth.getSession(); return s && s.email === BC.auth.ADMIN_EMAIL; },
    getCurrentUser() { return BC.auth.getSession(); },

    login(email, password) {
      // Admin login
      if (email === BC.auth.ADMIN_EMAIL && password === BC.auth.ADMIN_PASSWORD) {
        const session = { id: 'admin', email, name: 'Admin', isAdmin: true, createdAt: new Date().toISOString() };
        BC.storage.set('session', session);
        return { ok: true, user: session };
      }
      // Regular users
      const users = BC.storage.get('users', []);
      const user = users.find(u => u.email === email && u.password === password);
      if (!user) return { ok: false, error: 'Email ou senha incorretos.' };
      if (user.isActive === false) return { ok: false, error: 'Conta bloqueada. Entre em contato com o suporte ou confira a notificação da administração global.' };
      const session = { id: user.id, email: user.email, name: user.name, isAdmin: false, createdAt: user.createdAt };
      BC.storage.set('session', session);
      return { ok: true, user: session };
    },

    register(name, email, password) {
      const users = BC.storage.get('users', []);
      if (users.find(u => u.email === email)) return { ok: false, error: 'Email já cadastrado.' };
      const user = { id: BC.uuid(), name, email, password, createdAt: new Date().toISOString() };
      users.push(user);
      BC.storage.set('users', users);
      const session = { id: user.id, email: user.email, name: user.name, isAdmin: false, createdAt: user.createdAt };
      BC.storage.set('session', session);
      return { ok: true, user: session };
    },

    logout() {
      BC.storage.remove('session');
      window.location.href = '/pages/login.html';
    },

    requireAuth() {
      if (!BC.auth.isLoggedIn()) { window.location.href = '/pages/login.html'; return false; }
      return true;
    },
    requireAdmin() {
      if (!BC.auth.isAdmin()) { window.location.href = '/pages/dashboard.html'; return false; }
      return true;
    },

    async setupBiometrics() {
      if (!window.PublicKeyCredential) {
        BC.toast.error('Não suportado', 'Seu navegador não suporta autenticação biométrica.');
        return false;
      }
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!available) {
        BC.toast.error('Indisponível', 'Nenhum sensor de biometria ou senha de dispositivo encontrado.');
        return false;
      }

      try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        const user = BC.auth.getCurrentUser();

        await navigator.credentials.create({
          publicKey: {
            challenge,
            rp: { name: "BatCheckout" },
            user: {
              id: new TextEncoder().encode(user.id),
              name: user.email,
              displayName: user.name
            },
            pubKeyCredParams: [{ alg: -7, type: "public-key" }],
            authenticatorSelection: { authenticatorAttachment: "platform" },
            timeout: 60000
          }
        });

        BC.auth.updateUser(user.id, { biometricsEnabled: true });
        BC.toast.success('Biometria Ativada', 'Seu FaceID/Senha foi vinculado com sucesso.');
        return true;
      } catch (err) {
        console.error(err);
        BC.toast.error('Erro', 'Falha ao configurar biometria. Verifique as permissões do sistema.');
        return false;
      }
    },

    async verifyBiometrics() {
      if (!window.PublicKeyCredential) return true; // Fallback for unsupported
      try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        const cred = await navigator.credentials.get({
          publicKey: {
            challenge,
            timeout: 60000,
            userVerification: "required"
          }
        });
        return !!cred;
      } catch (err) {
        return false;
      }
    },

    updateUser(id, data) {
      const users = BC.storage.get('users', []);
      const idx = users.findIndex(u => u.id === id);
      if (idx !== -1) {
        users[idx] = { ...users[idx], ...data };
        BC.storage.set('users', users);
        // Refresh session if it's the current user
        const sess = BC.auth.getSession();
        if (sess && sess.id === id) {
          BC.storage.set('session', { ...sess, ...data });
        }
      }
    }
  },

  // ===================================================================
  // USERS MANAGEMENT (Admin Only)
  // ===================================================================
  users: {
    getAll() { return BC.storage.get('users', []); },
    get(id) { return BC.users.getAll().find(u => u.id === id); },
    update(id, data) {
      const list = BC.users.getAll();
      const idx = list.findIndex(u => u.id === id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...data };
        BC.storage.set('users', list);
      }
    },
    getLogs() { return BC.storage.get('fraudLogs', []); },
    addLog(userId, adminName, action, reason) {
      const logs = BC.users.getLogs();
      logs.unshift({
        id: BC.uuid(),
        userId,
        adminName,
        action,
        reason: reason || 'Nenhum motivo especificado',
        createdAt: new Date().toISOString()
      });
      BC.storage.set('fraudLogs', logs);
    },
    delete(id) {
      if (id === 'bat.adm@adm.com') return; // Cannot delete super admin
      const list = BC.users.getAll().filter(u => u.id !== id);
      BC.storage.set('users', list);

      // Cleanup associated data
      localStorage.removeItem(`bat_products_${id}`);
      localStorage.removeItem(`bat_checkouts_${id}`);
      localStorage.removeItem(`bat_transactions_${id}`);
      localStorage.removeItem(`bat_webhooks_${id}`);
      localStorage.removeItem(`bat_gateway_configs_${id}`);
    }
  },

  // ===================================================================
  // UUID
  // ===================================================================
  uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  },

  // ===================================================================
  // DATE / FORMAT
  // ===================================================================
  format: {
    currency(value) {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
    },
    date(iso) {
      if (!iso) return '—';
      return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    },
    datetime(iso) {
      if (!iso) return '—';
      return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    },
    shortDate(iso) {
      if (!iso) return '—';
      const d = new Date(iso);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    },
    cpf(v) {
      return v.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    },
    phone(v) {
      return v.replace(/\D/g, '').replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    },
  },

  // ===================================================================
  // PRODUCTS (namespaced per user)
  // ===================================================================
  products: {
    _key() { return `products_${BC.auth.getCurrentUser()?.id || 'anon'}`; },
    getAll() { return BC.storage.get(BC.__products_key(), []); },
    get(id) { return BC.products.getAll().find(p => p.id === id); },
    save(data) {
      const list = BC.products.getAll();
      if (data.id) {
        const idx = list.findIndex(p => p.id === data.id);
        if (idx >= 0) list[idx] = { ...list[idx], ...data, updatedAt: new Date().toISOString() };
        else list.push({ ...data, createdAt: new Date().toISOString() });
      } else {
        data.id = BC.uuid();
        data.createdAt = new Date().toISOString();
        list.push(data);
      }
      BC.storage.set(BC.__products_key(), list);
      return data;
    },
    delete(id) {
      const list = BC.products.getAll().filter(p => p.id !== id);
      BC.storage.set(BC.__products_key(), list);
    },
  },
  __products_key() { return `products_${BC.auth.getCurrentUser()?.id || 'anon'}`; },

  // ===================================================================
  // CHECKOUTS (namespaced per user)
  // ===================================================================
  checkouts: {
    _key() { return `checkouts_${BC.auth.getCurrentUser()?.id || 'anon'}`; },
    getAll() { return BC.storage.get(BC.checkouts._key(), []); },
    get(id) { return BC.checkouts.getAll().find(c => c.id === id); },
    getBySlug(slug) { return BC.checkouts.getAll().find(c => c.slug === slug); },
    save(data) {
      const list = BC.checkouts.getAll();
      if (data.id) {
        const idx = list.findIndex(c => c.id === data.id);
        if (idx >= 0) list[idx] = { ...list[idx], ...data, updatedAt: new Date().toISOString() };
        else list.push({ ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      } else {
        data.id = BC.uuid();
        data.createdAt = new Date().toISOString();
        data.updatedAt = new Date().toISOString();
        list.push(data);
      }
      BC.storage.set(BC.checkouts._key(), list);
      return data;
    },
    delete(id) {
      const list = BC.checkouts.getAll().filter(c => c.id !== id);
      BC.storage.set(BC.checkouts._key(), list);
    },
  },

  // ===================================================================
  // TRANSACTIONS (namespaced per user)
  // ===================================================================
  transactions: {
    _key() { return `transactions_${BC.auth.getCurrentUser()?.id || 'anon'}`; },
    getAll() {
      return BC.storage.get(BC.transactions._key(), []);
    },
    getGlobal() {
      if (!BC.auth.isAdmin()) return [];
      const keys = Object.keys(localStorage);
      const userKeys = keys.filter(k => k.startsWith('bat_transactions_'));
      let all = [];
      userKeys.forEach(key => {
        const uid = key.replace('bat_transactions_', '');
        if (uid === 'bat.adm@adm.com') return;
        const txs = JSON.parse(localStorage.getItem(key)) || [];
        all = all.concat(txs.map(t => ({ ...t, ownerId: uid })));
      });
      return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    get(id) {
      return BC.transactions.getAll().find(t => t.id === id);
    },
    save(data) {
      const list = BC.transactions.getAll();
      if (!data.id) {
        data.id = BC.uuid();
        data.createdAt = new Date().toISOString();
      }
      list.unshift(data);
      BC.storage.set(BC.transactions._key(), list);
      return data;
    },
    updateStatus(id, status) {
      const list = BC.transactions.getAll();
      const idx = list.findIndex(t => t.id === id);
      if (idx >= 0) { list[idx].status = status; list[idx].updatedAt = new Date().toISOString(); }
      BC.storage.set(BC.transactions._key(), list);
    },
  },

  // ===================================================================
  // WEBHOOKS
  // ===================================================================
  webhooks: {
    _key() { return `webhooks_${BC.auth.getCurrentUser()?.id || 'anon'}`; },
    getAll() { return BC.storage.get(BC.webhooks._key(), []); },
    save(data) {
      const list = BC.webhooks.getAll();
      if (data.id) {
        const idx = list.findIndex(w => w.id === data.id);
        if (idx >= 0) list[idx] = { ...list[idx], ...data };
        else list.push({ ...data, createdAt: new Date().toISOString() });
      } else {
        data.id = BC.uuid();
        data.createdAt = new Date().toISOString();
        list.push(data);
      }
      BC.storage.set(BC.webhooks._key(), list);
      return data;
    },
    delete(id) {
      BC.storage.set(BC.webhooks._key(), BC.webhooks.getAll().filter(w => w.id !== id));
    },
  },

  // ===================================================================
  // API KEYS
  // ===================================================================
  apiKeys: {
    _key() { return `apikeys_${BC.auth.getCurrentUser()?.id || 'anon'}`; },
    getAll() { return BC.storage.get(BC.apiKeys._key(), []); },
    generate(name) {
      const key = { id: BC.uuid(), name, key: 'bat_' + [...Array(32)].map(() => Math.random().toString(36)[2] || '0').join(''), createdAt: new Date().toISOString(), lastUsed: null };
      const list = BC.apiKeys.getAll();
      list.push(key);
      BC.storage.set(BC.apiKeys._key(), list);
      return key;
    },
    delete(id) { BC.storage.set(BC.apiKeys._key(), BC.apiKeys.getAll().filter(k => k.id !== id)); },
  },

  // ===================================================================
  // GATEWAY / INTEGRATION SETTINGS
  // ===================================================================
  integrations: {
    _key() { return `integrations_${BC.auth.getCurrentUser()?.id || 'anon'}`; },
    get() { return BC.storage.get(BC.integrations._key(), {}); },
    set(data) { BC.storage.set(BC.integrations._key(), { ...BC.integrations.get(), ...data }); },
  },

  // ===================================================================
  // ACCOUNT SETTINGS
  // ===================================================================
  settings: {
    _key() { return `settings_${BC.auth.getCurrentUser()?.id || 'anon'}`; },
    get() { return BC.storage.get(BC.settings._key(), {}); },
    set(data) { BC.storage.set(BC.settings._key(), { ...BC.settings.get(), ...data }); },
  },

  // ===================================================================
  // TOAST NOTIFICATIONS
  // ===================================================================
  toast: {
    show(type, title, msg = '', duration = 4000) {
      const icons = {
        success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
        error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
        info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
        warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      };
      let container = document.querySelector('.toast-container');
      if (!container) { container = document.createElement('div'); container.className = 'toast-container'; document.body.appendChild(container); }
      const t = document.createElement('div');
      t.className = `toast ${type}`;
      t.innerHTML = `${icons[type] || icons.info}<div><div class="toast-title">${title}</div>${msg ? `<div class="toast-msg">${msg}</div>` : ''}</div>`;
      container.appendChild(t);
      setTimeout(() => { t.style.animation = 'slideIn 0.3s ease reverse'; setTimeout(() => t.remove(), 300); }, duration);
    },
    success(title, msg) { BC.toast.show('success', title, msg); },
    error(title, msg) { BC.toast.show('error', title, msg); },
    info(title, msg) { BC.toast.show('info', title, msg); },
    warning(title, msg) { BC.toast.show('warning', title, msg); },
  },

  // ===================================================================
  // MODAL
  // ===================================================================
  modal: {
    open(id) { const m = document.getElementById(id); if (m) { m.classList.add('open'); document.body.style.overflow = 'hidden'; } },
    close(id) { const m = document.getElementById(id); if (m) { m.classList.remove('open'); document.body.style.overflow = ''; } },
    closeAll() { document.querySelectorAll('.modal-overlay.open').forEach(m => { m.classList.remove('open'); document.body.style.overflow = ''; }); },
  },

  // ===================================================================
  // ICONS (inline SVG helpers)
  // ===================================================================
  icon(name, size = 18) {
    const icons = {
      dashboard: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
      products: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`,
      checkout: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
      transactions: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
      webhooks: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
      integrations: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
      settings: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
      admin: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
      plus: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
      edit: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
      trash: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
      copy: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
      eye: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
      eyeOff: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,
      zap: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
      bell: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
      logout: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
      arrowUp: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`,
      arrowDown: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`,
      search: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
      filter: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`,
      key: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>`,
      users: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
      trending: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
      check: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
      x: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
      menu: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
      externalLink: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
      refresh: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`,
      pix: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,
      image: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
      link: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
      barChart: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>`,
      card: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
      percent: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>`,
    };
    return icons[name] || icons.check;
  },

  // ===================================================================
  // CPF VALIDATION
  // ===================================================================
  validateCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
    let rem = (sum * 10) % 11;
    if (rem === 10 || rem === 11) rem = 0;
    if (rem !== parseInt(cpf[9])) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
    rem = (sum * 10) % 11;
    if (rem === 10 || rem === 11) rem = 0;
    return rem === parseInt(cpf[10]);
  },

  // ===================================================================
  // SIDEBAR
  // ===================================================================
  sidebar: {
    init() {
      // Mobile toggle
      const btn = document.querySelector('.mobile-menu-btn');
      const sidebar = document.querySelector('.sidebar');
      const overlay = document.querySelector('.sidebar-overlay');
      if (btn && sidebar) {
        btn.addEventListener('click', () => {
          sidebar.classList.toggle('mobile-open');
          overlay.classList.toggle('mobile-open');
        });
      }
      if (overlay) {
        overlay.addEventListener('click', () => {
          sidebar.classList.remove('mobile-open');
          overlay.classList.remove('mobile-open');
        });
      }
      // Active nav
      const path = window.location.pathname;
      document.querySelectorAll('.nav-item').forEach(el => {
        if (el.getAttribute('href') && path.includes(el.getAttribute('href').replace('../pages/', '').replace('.html', ''))) {
          el.classList.add('active');
        }
      });
      // User info
      const session = BC.auth.getSession();
      if (session) {
        const nameEl = document.querySelector('.sidebar-user .user-name');
        const emailEl = document.querySelector('.sidebar-user .user-email');
        const avatarEl = document.querySelector('.sidebar-user .avatar');
        if (nameEl) nameEl.textContent = session.name || session.email;
        if (emailEl) emailEl.textContent = session.email;
        if (avatarEl) avatarEl.textContent = (session.name || session.email || 'U')[0].toUpperCase();
        // Admin link
        if (session.isAdmin) {
          document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
        }
      }
      // Logout
      document.getElementById('logoutBtn')?.addEventListener('click', BC.auth.logout);
    },
  },

  // ===================================================================
  // DEMO DATA GENERATOR
  // ===================================================================
  generateDemoData() {
    const uid = BC.auth.getCurrentUser()?.id;
    if (!uid) return;
    const txKey = `bat_transactions_${uid}`;
    if (localStorage.getItem(txKey)) return; // Already has data
    const statuses = ['approved', 'approved', 'approved', 'pending', 'refused'];
    const products = ['Curso de Marketing Digital', 'E-book SEO Avançado', 'Mentoria Premium', 'Pack de Templates', 'Consultoria Express'];
    const names = ['Ana Lima', 'Carlos Souza', 'Fernanda Costa', 'Ricardo Alves', 'Juliana Matos', 'Bruno Ferreira', 'Mariana Silva', 'Diego Santos'];
    const txs = [];
    for (let i = 0; i < 40; i++) {
      const d = new Date();
      d.setDate(d.getDate() - Math.floor(Math.random() * 30));
      txs.push({
        id: BC.uuid(),
        productName: products[Math.floor(Math.random() * products.length)],
        customerName: names[Math.floor(Math.random() * names.length)],
        customerEmail: `cliente${i}@email.com`,
        amount: (Math.random() * 500 + 50).toFixed(2),
        status: statuses[Math.floor(Math.random() * statuses.length)],
        method: 'pix',
        createdAt: d.toISOString(),
      });
    }
    BC.storage.set(`transactions_${uid}`, txs);
  },

  // ===================================================================
  // ADMIN ADVANCED TOOLS
  // ===================================================================
  admin: {
    adjustMetrics(userId, targetTotal, targetSales) {
      const key = `transactions_${userId}`;
      const txs = BC.storage.get(key, []);
      const approved = txs.filter(t => t.status === 'approved');
      const currentTotal = approved.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
      const currentSales = approved.length;

      const diffTotal = targetTotal - currentTotal;
      const diffSales = targetSales - currentSales;

      if (diffSales > 0) {
        for (let i = 0; i < diffSales; i++) {
          txs.unshift({
            id: 'adj_s_' + BC.uuid().substring(0, 8),
            productName: 'Ajuste de Vendas',
            customerName: 'Sistema (Admin)',
            amount: (diffTotal / diffSales).toFixed(2),
            status: 'approved',
            method: 'adjustment',
            createdAt: new Date().toISOString()
          });
        }
      } else if (diffTotal !== 0) {
        txs.unshift({
          id: 'adj_v_' + BC.uuid().substring(0, 8),
          productName: 'Ajuste de Saldo',
          customerName: 'Sistema (Admin)',
          amount: diffTotal.toFixed(2),
          status: 'approved',
          method: 'adjustment',
          createdAt: new Date().toISOString()
        });
      }
      BC.storage.set(key, txs);
    },
    adjustConversion(userId, targetPercent) {
      const key = `transactions_${userId}`;
      const txs = BC.storage.get(key, []);
      const approved = txs.filter(t => t.status === 'approved').length;

      if (approved === 0) return; // Cannot set rate if no sales

      // targetPercent = (approved / total) * 100
      // total = (approved * 100) / targetPercent
      const targetTotal = Math.round((approved * 100) / targetPercent);
      const currentTotal = txs.length;
      const diff = targetTotal - currentTotal;

      if (diff > 0) {
        // Add pending/refused to lower the rate
        for (let i = 0; i < diff; i++) {
          txs.unshift({
            id: 'adj_c_' + BC.uuid().substring(0, 8),
            productName: 'Ajuste de Conversão',
            customerName: 'Lead (Ajuste)',
            amount: '0.00',
            status: Math.random() > 0.5 ? 'pending' : 'refused',
            method: 'pix',
            createdAt: new Date().toISOString()
          });
        }
      } else if (diff < 0) {
        // We would need to remove non-approved transactions to increase the rate
        // but for safety we'll just filter out some pending/refused
        let toRemove = Math.abs(diff);
        for (let i = txs.length - 1; i >= 0 && toRemove > 0; i--) {
          if (txs[i].status !== 'approved') {
            txs.splice(i, 1);
            toRemove--;
          }
        }
      }
      BC.storage.set(key, txs);
    },
    sendPush(userId, title, message) {
      const notifs = BC.storage.get(`notifications_${userId}`, []);
      notifs.unshift({ id: BC.uuid(), title, message, createdAt: new Date().toISOString(), read: false });
      BC.storage.set(`notifications_${userId}`, notifs);

      const channel = new BroadcastChannel(`notif_${userId}`);
      channel.postMessage({ type: 'push', title, message });
    }
  },

  // ===================================================================
  // CLIPBOARD
  // ===================================================================
  copyToClipboard(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => BC.toast.success('Copiado!', 'Texto copiado para a área de transferência.'));
    } else {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      BC.toast.success('Copiado!', 'Texto copiado para a área de transferência.');
    }
  },
};

// Auto-init
window.BC = BC;
