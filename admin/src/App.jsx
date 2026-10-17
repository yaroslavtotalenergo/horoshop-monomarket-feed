import { useState, useEffect, useMemo } from 'react';
import { GitHubApi } from './api';
import Editor, { 
  EditorProvider,
  Toolbar,
  BtnUndo,
  BtnRedo,
  BtnBold,
  BtnItalic,
  BtnUnderline,
  BtnStrikeThrough,
  BtnNumberedList,
  BtnBulletList,
  BtnLink,
  BtnClearFormatting,
  BtnStyles,
  HtmlButton,
  Separator,
  createButton
} from 'react-simple-wysiwyg';

const BtnH3 = createButton('Заголовок H3', <b style={{fontSize: '12px'}}>H3</b>, () => document.execCommand('formatBlock', false, 'H3'));
import './index.css';
import * as XLSX from 'xlsx';

const REPO_OWNER = 'yaroslavtotalenergo';
const REPO_NAME = 'horoshop-monomarket-feed';
const FEED_URLS = {
  xml: `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/feeds/products.xml`,
  json: `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/feeds/prices.json`,
  horoshop: `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/feeds/horoshop-monobank.xml`,
};

// Simple hash function for password storage
async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const STORED_LOGIN = 'admin';
const STORED_PASS_HASH = 'dfb7ab365bc2e031fb610a44224750dad0646f963a18a96ec213160bc0c26e46';

function isHoroshopOutOfStock(product) {
  if (!product) return false;
  if (product.horoshopAvailable !== undefined) {
    return product.horoshopAvailable === false || product.horoshopAvailable === 'false';
  }
  return product.available === false || product.available === 'false';
}

export function LoginGate({ children }) {
  const [authed, setAuthed] = useState(() => localStorage.getItem('panel_auth') === 'ok');
  const [login, setLogin] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const passHash = await hashPassword(pass);
    if (login.trim() === STORED_LOGIN && passHash === STORED_PASS_HASH) {
      localStorage.setItem('panel_auth', 'ok');
      setAuthed(true);
    } else {
      setError('Невірний логін або пароль');
    }
    setLoading(false);
  };

  if (authed) return children;

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
    }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '380px', padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>⚡</div>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>CRM PRO</h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>Панель керування</p>
        </div>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Логін</label>
            <input
              type="text" className="input-field" autoComplete="username"
              value={login} onChange={e => setLogin(e.target.value)}
              placeholder="Введіть логін"
              style={{ fontSize: '1rem' }}
            />
          </div>
          <div className="form-group">
            <label>Пароль</label>
            <input
              type="password" className="input-field" autoComplete="current-password"
              value={pass} onChange={e => setPass(e.target.value)}
              placeholder="••••••••"
              style={{ fontSize: '1rem' }}
            />
          </div>
          {error && <p style={{ color: '#f87171', margin: '0 0 1rem', fontSize: '0.9rem' }}>{error}</p>}
          <button type="submit" className="btn success" style={{ width: '100%', padding: '0.85rem', fontSize: '1rem' }} disabled={loading}>
            {loading ? <span className="loader"></span> : 'Увійти →'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('gh_token') || '');
  const [feedUrl, setFeedUrl] = useState('');
  const [catalog, setCatalog] = useState([]);
  const [whitelist, setWhitelist] = useState([]);
  const [alwaysAvailable, setAlwaysAvailable] = useState([]);
  const [barcodes, setBarcodes] = useState({});
  const [descriptions, setDescriptions] = useState({});
  const [availabilityOverrides, setAvailabilityOverrides] = useState({});
  const [stockOverrides, setStockOverrides] = useState({});
  const [names, setNames] = useState({});
  const [videos, setVideos] = useState({});

  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [activeTab, setActiveTab] = useState('catalog');
  const [syncingAll, setSyncingAll] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  
  const [promWhitelist, setPromWhitelist] = useState([]);
  const [promSkus, setPromSkus] = useState([]);
  const [syncingProm, setSyncingProm] = useState(false);
  const [savingProm, setSavingProm] = useState(false);
  const [promSearchQuery, setPromSearchQuery] = useState('');
  const [promFilterMode, setPromFilterMode] = useState('all');
  const [promCategoryFilter, setPromCategoryFilter] = useState('all');
  const [collapsedPromCategories, setCollapsedPromCategories] = useState({});
  
  const [savingHoroshop, setSavingHoroshop] = useState(false);
  const [syncingHoroshop, setSyncingHoroshop] = useState(false);
  const [horoshopSearchQuery, setHoroshopSearchQuery] = useState('');
  const [horoshopFilterMode, setHoroshopFilterMode] = useState('all');
  const [horoshopCategoryFilter, setHoroshopCategoryFilter] = useState('all');
  const [horoshopPresence, setHoroshopPresence] = useState({});
  const [horoshopInstallments, setHoroshopInstallments] = useState({});
  const [horoshopDisabled, setHoroshopDisabled] = useState([]);
  const [collapsedHoroshopCategories, setCollapsedHoroshopCategories] = useState({});
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState('');
  const [showSettings, setShowSettings] = useState(!token);
  const [showLinks, setShowLinks] = useState(false);
  
  const [workflowRuns, setWorkflowRuns] = useState([]);
  const [showLogs, setShowLogs] = useState(false);
  const [stockChanges, setStockChanges] = useState([]);
  const [showStockLog, setShowStockLog] = useState(false);
  const [stockLogSearch, setStockLogSearch] = useState('');
  const [stockLogFilter, setStockLogFilter] = useState('all'); // 'all', 'became_zero', 'became_available', 'changed'
  const [lastSeenStockTime, setLastSeenStockTime] = useState(() => {
    try { return localStorage.getItem('last_seen_stock_time') || ''; } catch (e) { return ''; }
  });

  const unreadStockCount = useMemo(() => {
    if (!stockChanges || stockChanges.length === 0) return 0;
    if (!lastSeenStockTime) return stockChanges.length;
    const lastTime = new Date(lastSeenStockTime).getTime();
    return stockChanges.filter(c => new Date(c.timestamp).getTime() > lastTime).length;
  }, [stockChanges, lastSeenStockTime]);

  const openStockLog = () => {
    setShowStockLog(true);
    const now = new Date().toISOString();
    setLastSeenStockTime(now);
    try { localStorage.setItem('last_seen_stock_time', now); } catch (e) { }
  };

  const navigateToHoroshop = (vendorCode) => {
    setActiveTab('horoshop');
    setHoroshopSearchQuery(vendorCode);
    setHoroshopFilterMode('all');
    setShowStockLog(false);
    showToast(`📦 Відкрито товар ${vendorCode} в розділі Хорошоп`);
  };

  const navigateToProm = (vendorCode) => {
    setActiveTab('prom');
    setPromSearchQuery(vendorCode);
    setPromFilterMode('all');
    setShowStockLog(false);
    showToast(`🟣 Відкрито товар ${vendorCode} в розділі Prom.ua`);
  };

  const navigateToMono = (vendorCode) => {
    setActiveTab('catalog');
    setSearchQuery(vendorCode);
    setFilterMode('all');
    setShowStockLog(false);
    showToast(`🐾 Відкрито товар ${vendorCode} в розділі Мономаркет`);
  };

  const handleClearStockLog = async () => {
    if (!window.confirm('Ви впевнені, що хочете очистити журнал змін залишків?')) return;
    try {
      await api.saveFile('src/stock-changes.json', JSON.stringify([], null, 2), shas.stockChanges, 'Очищено журнал змін залишків');
      setStockChanges([]);
      showToast('🗑️ Журнал змін залишків очищено!');
    } catch (e) {
      showToast('❌ Помилка очищення: ' + (e?.message || ''));
    }
  };
  const [previewProduct, setPreviewProduct] = useState(null);
  const [editingDescriptionProduct, setEditingDescriptionProduct] = useState(null);

  const [shas, setShas] = useState({ whitelist: null, barcodes: null, descriptions: null, config: null });

  const api = useMemo(() => new GitHubApi(token, REPO_OWNER, REPO_NAME), [token]);

  useEffect(() => { 
    if (token) {
      loadData(); 
      loadLogs();
    }
  }, [token]);

  const loadLogs = async () => {
    if (!api) return;
    const runs = await api.getWorkflowRuns(10);
    setWorkflowRuns(runs);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [catalogRes, whitelistRes, barcodesRes, descRes, configRes, availRes, stockRes, namesRes, videosRes, alwaysAvailRes, promWhitelistRes, promSkusRes, horoshopDisabledRes, horoshopPresenceRes, horoshopInstallmentsRes, stockChangesRes] = await Promise.all([
        api.getFile('feeds/catalog.json'),
        api.getFile('src/whitelist.json'),
        api.getFile('src/barcodes.json'),
        api.getFile('src/descriptions.json'),
        api.getFile('src/config.json'),
        api.getFile('src/availability.json'),
        api.getFile('src/stock.json'),
        api.getFile('src/names.json'),
        api.getFile('src/videos.json'),
        api.getFile('src/always-available.json'),
        api.getFile('src/prom-whitelist.json'),
        api.getFile('src/prom-skus.json'),
        api.getFile('src/horoshop-disabled.json'),
        api.getFile('src/horoshop-presence.json'),
        api.getFile('src/horoshop-installments.json'),
        api.getFile('src/stock-changes.json')
      ]);

      if (catalogRes.content) {
        const parsed = JSON.parse(catalogRes.content);
        setCatalog(Array.isArray(parsed) ? parsed : (parsed.data || []));
      }
      if (whitelistRes.content) setWhitelist(JSON.parse(whitelistRes.content) || []);
      if (alwaysAvailRes && alwaysAvailRes.content) setAlwaysAvailable(JSON.parse(alwaysAvailRes.content) || []);
      if (horoshopDisabledRes && horoshopDisabledRes.content) {
        try { setHoroshopDisabled(JSON.parse(horoshopDisabledRes.content) || []); } catch (e) { }
      }
      if (horoshopPresenceRes && horoshopPresenceRes.content) {
        try { setHoroshopPresence(JSON.parse(horoshopPresenceRes.content) || {}); } catch (e) { }
      }
      if (horoshopInstallmentsRes && horoshopInstallmentsRes.content) {
        try { setHoroshopInstallments(JSON.parse(horoshopInstallmentsRes.content) || {}); } catch (e) { }
      }
      if (barcodesRes.content) setBarcodes(JSON.parse(barcodesRes.content) || {});
      if (descRes.content) setDescriptions(JSON.parse(descRes.content) || {});
      if (availRes.content) setAvailabilityOverrides(JSON.parse(availRes.content) || {});
      if (stockRes.content) setStockOverrides(JSON.parse(stockRes.content) || {});
      if (namesRes.content) setNames(JSON.parse(namesRes.content) || {});
      if (videosRes && videosRes.content) setVideos(JSON.parse(videosRes.content) || {});
      if (configRes.content) setFeedUrl(JSON.parse(configRes.content).horoshopFeedUrl || '');
      
      if (promWhitelistRes && promWhitelistRes.content) {
        try { setPromWhitelist(JSON.parse(promWhitelistRes.content) || []); } catch (e) { }
      }
      if (promSkusRes && promSkusRes.content) {
        try { setPromSkus(JSON.parse(promSkusRes.content) || []); } catch (e) { }
      }
      
      if (stockChangesRes && stockChangesRes.content) {
        try {
          const parsedChanges = JSON.parse(stockChangesRes.content);
          if (Array.isArray(parsedChanges)) setStockChanges(parsedChanges);
        } catch (e) { }
      }

      setShas({
        whitelist: whitelistRes.sha,
        barcodes: barcodesRes.sha,
        descriptions: descRes.sha,
        stockChanges: stockChangesRes ? stockChangesRes.sha : null,
        config: configRes.sha
      });
    } catch (e) {
      showToast('Помилка завантаження! Перевірте токен.');
    }
    setLoading(false);
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const handleTriggerFeed = async () => {
    setSyncing(true);
    try {
      await api.triggerWorkflow();
      showToast('\u2705 \u0424\u0456\u0434 \u0437\u0430\u043f\u0443\u0449\u0435\u043d\u043e! \u041e\u043d\u043e\u0432\u043b\u044e\u0454\u0442\u044c\u0441\u044f (~1 \u0445\u0432');
    } catch (e) {
      showToast('\u274c \u041f\u043e\u043c\u0438\u043b\u043a\u0430 \u0437\u0430\u043f\u0443\u0441\u043a\u0443: ' + (e?.message || ''));
    }
    setSyncing(false);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      // Save files sequentially to avoid concurrent SHA conflicts
      await api.saveFile('src/whitelist.json', JSON.stringify(whitelist, null, 2), null, 'Update whitelist via UI');
      await api.saveFile('src/always-available.json', JSON.stringify(alwaysAvailable, null, 2), null, 'Update always available via UI');
      await api.saveFile('src/barcodes.json', JSON.stringify(barcodes, null, 2), null, 'Update barcodes via UI');
      await api.saveFile('src/descriptions.json', JSON.stringify(descriptions, null, 2), null, 'Update descriptions via UI');
      // Clean up empty strings from stockOverrides before saving
      const cleanStock = { ...stockOverrides };
      for (const k in cleanStock) {
        if (cleanStock[k] === '') cleanStock[k] = 10;
      }
      
      await api.saveFile('src/availability.json', JSON.stringify(availabilityOverrides, null, 2), null, 'Update availability via UI');
      await api.saveFile('src/stock.json', JSON.stringify(cleanStock, null, 2), null, 'Update stock via UI');
      await api.saveFile('src/names.json', JSON.stringify(names, null, 2), null, 'Update custom names via UI');
      await api.saveFile('src/videos.json', JSON.stringify(videos, null, 2), null, 'Update custom videos via UI');
      await api.triggerWorkflow();
      showToast('\u2705 \u0414\u0430\u043d\u0456 \u0437\u0431\u0435\u0440\u0435\u0436\u0435\u043d\u043e! \u0424\u0456\u0434 \u043e\u043d\u043e\u0432\u043b\u044e\u0454\u0442\u044c\u0441\u044f...');
    } catch (e) {
      console.error('Save error:', e);
      showToast('\u274c \u041f\u043e\u043c\u0438\u043b\u043a\u0430: ' + (e?.message || '\u043d\u0435\u0432\u0456\u0434\u043e\u043c\u0430 \u043f\u043e\u043c\u0438\u043b\u043a\u0430'));
    }
    setSaving(false);
  };

  const handleSaveSettings = async () => {
    localStorage.setItem('gh_token', token);
    setShowSettings(false);
    showToast('✅ Налаштування збережено');
  };

  const togglePromWhitelist = (vendorCode) => {
    setPromWhitelist(prev =>
      prev.includes(vendorCode)
        ? prev.filter(c => c !== vendorCode)
        : [...prev, vendorCode]
    );
  };

  const handleSaveProm = async () => {
    setSavingProm(true);
    try {
      await api.saveFile('src/prom-whitelist.json', JSON.stringify(promWhitelist, null, 2), null, 'Update Prom whitelist via UI');
      showToast('💾 Збережено! Запускаємо передачу на Prom.ua...');
      try {
        await api.triggerWorkflow();
        showToast('✅ Збережено та відправлено на Prom.ua! (~1-2 хв)');
      } catch (_) {
        showToast('✅ Збережено! (Оновиться за графіком або натисніть "Синхронізувати")');
      }
    } catch (e) {
      console.error('Prom save error:', e);
      showToast('❌ Помилка: ' + (e?.message || 'невідома'));
    }
    setSavingProm(false);
  };

  const handleTriggerPromSync = async () => {
    setSyncingProm(true);
    try {
      await api.triggerWorkflow();
      showToast('✅ Синхронізацію з Prom.ua запущено (~1-2 хв)');
    } catch (e) {
      showToast('❌ Помилка запуску: ' + (e?.message || ''));
    }
    setSyncingProm(false);
  };

  const promSkusSet = useMemo(() => new Set(promSkus.map(s => String(s).trim())), [promSkus]);
  const promWhitelistSet = useMemo(() => new Set(promWhitelist.map(s => String(s).trim())), [promWhitelist]);

  const handleBulkPromToggle = (enable) => {
    const targetCodes = filteredPromCatalog
      .map(p => p.vendorCode ? String(p.vendorCode).trim() : '')
      .filter(code => code && (enable ? promSkusSet.has(code) : true));
    setPromWhitelist(prev => {
      const prevSet = new Set(prev);
      targetCodes.forEach(code => {
        if (enable) prevSet.add(code);
        else prevSet.delete(code);
      });
      return Array.from(prevSet);
    });
    showToast(enable ? `🟣 Увімкнено ${targetCodes.length} товарів для Prom` : `⚪ Вимкнено ${targetCodes.length} товарів з Prom`);
  };

  const filteredPromCatalog = useMemo(() => {
    const q = promSearchQuery.toLowerCase().trim();

    const filtered = catalog.filter(p => {
      const code = p.vendorCode ? String(p.vendorCode).trim() : '';
      const name = p.name || '';
      if (q) {
        const matchesQuery = name.toLowerCase().includes(q) || code.toLowerCase().includes(q);
        if (!matchesQuery) return false;
      }
      if (promCategoryFilter !== 'all' && (p.category || 'Без категорії') !== promCategoryFilter) {
        return false;
      }
      const isEnabled = promWhitelistSet.has(code);
      const existsOnProm = promSkusSet.has(code);
      const hasExcel = stockOverrides[code] !== undefined;
      let stock = hasExcel ? parseInt(stockOverrides[code], 10) : 0;
      if (alwaysAvailable.includes(code)) stock = Math.max(stock, 10);
      if (isNaN(stock) || stock < 0) stock = 0;
      const horoOut = isHoroshopOutOfStock(p);

      if (promFilterMode === 'no_match') return !existsOnProm;
      if (promFilterMode === 'out_of_stock_horoshop') return horoOut;
      if (promFilterMode === 'enabled') return isEnabled && existsOnProm;
      if (promFilterMode === 'disabled') return !isEnabled && existsOnProm;
      if (promFilterMode === 'in_stock') return isEnabled && existsOnProm && stock > 0;
      if (promFilterMode === 'out_of_stock') return isEnabled && existsOnProm && stock === 0;

      return true;
    });

    return filtered;
  }, [catalog, promSearchQuery, promCategoryFilter, promFilterMode, promWhitelistSet, stockOverrides, alwaysAvailable, promSkusSet]);

  const promStats = useMemo(() => {
    let enabledCount = 0;
    let inStockCount = 0;
    let outOfStockCount = 0;
    let disabledCount = 0;
    let noMatchCount = 0;
    let outOfStockHoroshopCount = 0;

    catalog.forEach(p => {
      const code = p.vendorCode ? String(p.vendorCode).trim() : '';
      const isEnabled = promWhitelistSet.has(code);
      const existsOnProm = promSkusSet.has(code);
      let stock = stockOverrides[code] !== undefined ? parseInt(stockOverrides[code], 10) : 0;
      if (alwaysAvailable.includes(code)) stock = Math.max(stock, 10);
      if (isNaN(stock) || stock < 0) stock = 0;

      if (isHoroshopOutOfStock(p)) {
        outOfStockHoroshopCount++;
      }

      if (!existsOnProm) {
        noMatchCount++;
      } else if (isEnabled) {
        enabledCount++;
        if (stock > 0) inStockCount++;
        else outOfStockCount++;
      } else {
        disabledCount++;
      }
    });

    return {
      total: catalog.length,
      enabled: enabledCount,
      inStock: inStockCount,
      outOfStock: outOfStockCount,
      disabled: disabledCount,
      noMatch: noMatchCount,
      outOfStockHoroshop: outOfStockHoroshopCount
    };
  }, [catalog, promWhitelistSet, stockOverrides, alwaysAvailable, promSkusSet]);

  const promGrouped = useMemo(() => {
    const map = {};
    for (const product of filteredPromCatalog) {
      const cat = product.category || 'Без категорії';
      if (!map[cat]) map[cat] = [];
      map[cat].push(product);
    }
    return Object.entries(map).sort(([catA], [catB]) => catA.localeCompare(catB, 'uk'));
  }, [filteredPromCatalog]);

  const getPromCategoryStats = (products) => {
    const enabled = products.filter(p => {
      const code = p.vendorCode ? String(p.vendorCode).trim() : '';
      return promWhitelistSet.has(code) && promSkusSet.has(code);
    }).length;
    return { enabled, total: products.length };
  };

  const togglePromCategory = (cat) => setCollapsedPromCategories(prev => {
    const isCurrentlyCollapsed = prev[cat] !== false;
    return { ...prev, [cat]: !isCurrentlyCollapsed };
  });

  const expandAllProm = () => {
    const next = {};
    promGrouped.forEach(([cat]) => { next[cat] = false; });
    setCollapsedPromCategories(next);
  };

  const collapseAllProm = () => {
    setCollapsedPromCategories({});
  };

  const toggleAlwaysAvailable = (vendorCode) => {
    setAlwaysAvailable(prev =>
      prev.includes(vendorCode)
        ? prev.filter(v => v !== vendorCode)
        : [...prev, vendorCode]
    );
  };

  const setProductPresenceMode = (vendorCode, mode) => {
    const code = String(vendorCode).trim();
    setHoroshopPresence(prev => {
      const next = { ...prev };
      if (mode === 'auto') {
        delete next[code];
      } else {
        next[code] = mode;
      }
      return next;
    });
  };

  const setProductInstallmentsMode = (vendorCode, mode) => {
    const code = String(vendorCode).trim();
    setHoroshopInstallments(prev => {
      const next = { ...prev };
      if (mode === 'auto') {
        delete next[code];
      } else {
        next[code] = mode;
      }
      return next;
    });
  };

  const handleBulkPresenceMode = (mode, targetList = filteredHoroshopCatalog) => {
    const targetCodes = targetList
      .map(p => p.vendorCode ? String(p.vendorCode).trim() : '')
      .filter(Boolean);
    setHoroshopPresence(prev => {
      const next = { ...prev };
      targetCodes.forEach(code => {
        if (mode === 'auto') delete next[code];
        else next[code] = mode;
      });
      return next;
    });
    const label = mode === 'off' ? '🔴 Примусово "Немає в наявності"' : mode === 'on' ? '🟢 Примусово "В наявності"' : '⚡ Автоматично за складом';
    showToast(`${label} для ${targetCodes.length} товарів`);
  };

  const handleBulkInstallmentsMode = (mode, targetList = filteredHoroshopCatalog) => {
    const targetCodes = targetList
      .map(p => p.vendorCode ? String(p.vendorCode).trim() : '')
      .filter(Boolean);
    setHoroshopInstallments(prev => {
      const next = { ...prev };
      targetCodes.forEach(code => {
        if (mode === 'auto') delete next[code];
        else next[code] = mode;
      });
      return next;
    });
    const label = mode === 'off' ? '🔴 Заборонено ОЧ' : mode === 'on' ? '🟣 Примусово ОЧ' : '⚡ Автоматично ОЧ';
    showToast(`${label} для ${targetCodes.length} товарів`);
  };

  const handleSaveHoroshop = async () => {
    setSavingHoroshop(true);
    try {
      await api.saveFile('src/horoshop-presence.json', JSON.stringify(horoshopPresence, null, 2), null, 'Update Horoshop presence settings via UI');
      await api.saveFile('src/horoshop-installments.json', JSON.stringify(horoshopInstallments, null, 2), null, 'Update Horoshop installments settings via UI');
      showToast('💾 Налаштування збережено! Запускаємо оновлення в Хорошоп...');
      try {
        await api.triggerWorkflow();
        showToast('✅ Збережено та передається в Хорошоп! (~1-2 хв)');
      } catch (_) {
        showToast('✅ Збережено! (Оновиться за розкладом або натисніть "Оновити Хорошоп")');
      }
    } catch (e) {
      console.error('Horoshop save error:', e);
      showToast('❌ Помилка збереження: ' + (e?.message || 'невідома'));
    } finally {
      setSavingHoroshop(false);
    }
  };

  const handleTriggerHoroshopSync = async () => {
    setSyncingHoroshop(true);
    try {
      await api.triggerWorkflow();
      showToast('✅ Оновлення Хорошопу запущено (~1-2 хв)');
    } catch (e) {
      showToast('❌ Помилка запуску: ' + (e?.message || ''));
    }
    setSyncingHoroshop(false);
  };

  const horoshopCategories = useMemo(() => {
    return Array.from(new Set(catalog.map(p => p.category || 'Без категорії'))).sort();
  }, [catalog]);

  const horoshopDisabledSet = useMemo(() => new Set(horoshopDisabled.map(s => String(s).trim())), [horoshopDisabled]);

  const getHoroshopItemData = (p) => {
    const code = p.vendorCode ? String(p.vendorCode).trim() : '';
    let rawStock = stockOverrides[code] !== undefined ? parseInt(stockOverrides[code], 10) : 0;
    let stock = isNaN(rawStock) || rawStock < 0 ? 0 : rawStock;

    // Presence mode: 'off' | 'auto' | 'on'
    const presenceMode = horoshopPresence[code] || 'auto';
    let isAvailable = false;
    if (presenceMode === 'off') {
      isAvailable = false;
    } else if (presenceMode === 'on') {
      isAvailable = true;
    } else {
      isAvailable = stock > 0;
    }

    // Installments mode: 'off' | 'auto' | 'on'
    let installmentsMode = horoshopInstallments[code];
    if (!installmentsMode) {
      if (horoshopDisabledSet.has(code)) installmentsMode = 'off';
      else if (alwaysAvailable.includes(code)) installmentsMode = 'on';
      else installmentsMode = 'auto';
    }

    let hasInstallments = false;
    if (presenceMode === 'off') {
      hasInstallments = false;
    } else if (installmentsMode === 'off') {
      hasInstallments = false;
    } else if (installmentsMode === 'on') {
      hasInstallments = true;
    } else {
      hasInstallments = isAvailable && stock > 0;
    }

    return {
      code,
      stock,
      presenceMode,
      isAvailable,
      installmentsMode,
      hasInstallments
    };
  };

  const horoshopStats = useMemo(() => {
    let inStockCount = 0;
    let forcedInStockCount = 0;
    let forcedOutOfStockCount = 0;
    let activeInstallments = 0;
    let forcedInstallments = 0;
    let disabledInstallments = 0;

    catalog.forEach(p => {
      const item = getHoroshopItemData(p);
      if (item.isAvailable) inStockCount++;
      if (item.presenceMode === 'on') forcedInStockCount++;
      else if (item.presenceMode === 'off') forcedOutOfStockCount++;

      if (item.hasInstallments) activeInstallments++;
      if (item.installmentsMode === 'on') forcedInstallments++;
      else if (item.installmentsMode === 'off') disabledInstallments++;
    });

    return {
      total: catalog.length,
      inStock: inStockCount,
      outOfStock: catalog.length - inStockCount,
      forcedInStock: forcedInStockCount,
      forcedOutOfStock: forcedOutOfStockCount,
      active: activeInstallments,
      forced: forcedInstallments,
      disabled: disabledInstallments
    };
  }, [catalog, horoshopPresence, horoshopInstallments, horoshopDisabledSet, alwaysAvailable, stockOverrides]);

  const filteredHoroshopCatalog = useMemo(() => {
    const q = horoshopSearchQuery.toLowerCase().trim();

    return catalog.filter(p => {
      const code = p.vendorCode ? String(p.vendorCode).trim() : '';
      const name = p.name || '';
      if (q) {
        const matches = name.toLowerCase().includes(q) || code.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (horoshopCategoryFilter !== 'all' && (p.category || 'Без категорії') !== horoshopCategoryFilter) {
        return false;
      }

      const item = getHoroshopItemData(p);

      if (horoshopFilterMode === 'presence_in_stock') return item.isAvailable;
      if (horoshopFilterMode === 'presence_out_of_stock') return !item.isAvailable;
      if (horoshopFilterMode === 'presence_on') return item.presenceMode === 'on';
      if (horoshopFilterMode === 'presence_off') return item.presenceMode === 'off';
      if (horoshopFilterMode === 'installments_active') return item.hasInstallments;
      if (horoshopFilterMode === 'installments_forced') return item.installmentsMode === 'on';
      if (horoshopFilterMode === 'installments_disabled') return item.installmentsMode === 'off';

      return true;
    });
  }, [catalog, horoshopSearchQuery, horoshopCategoryFilter, horoshopFilterMode, horoshopPresence, horoshopInstallments, horoshopDisabledSet, alwaysAvailable, stockOverrides]);

  const horoshopGrouped = useMemo(() => {
    const map = {};
    for (const product of filteredHoroshopCatalog) {
      const cat = product.category || 'Без категорії';
      if (!map[cat]) map[cat] = [];
      map[cat].push(product);
    }
    return Object.entries(map).sort(([catA], [catB]) => catA.localeCompare(catB, 'uk'));
  }, [filteredHoroshopCatalog]);

  const getHoroshopCategoryStats = (products) => {
    let inStockCount = 0;
    let activeCount = 0;
    products.forEach(p => {
      const item = getHoroshopItemData(p);
      if (item.isAvailable) inStockCount++;
      if (item.hasInstallments) activeCount++;
    });
    return { inStock: inStockCount, active: activeCount, total: products.length };
  };

  const toggleHoroshopCategory = (cat) => setCollapsedHoroshopCategories(prev => {
    const isCurrentlyCollapsed = prev[cat] !== false;
    return { ...prev, [cat]: !isCurrentlyCollapsed };
  });

  const expandAllHoroshop = () => {
    const next = {};
    horoshopGrouped.forEach(([cat]) => { next[cat] = false; });
    setCollapsedHoroshopCategories(next);
  };

  const collapseAllHoroshop = () => {
    setCollapsedHoroshopCategories({});
  };

  const handleTriggerFullSync = async () => {
    setSyncingAll(true);
    showToast('🚀 Повну синхронізацію запущено! Зачекайте ~40-50 секунд...');
    try {
      await api.triggerWorkflow();
      await new Promise(r => setTimeout(r, 45000));
      await loadData();
      showToast('✅ Синхронізацію завершено, дані оновлено!');
    } catch (e) {
      showToast('❌ Помилка запуску: ' + (e?.message || ''));
    } finally {
      setSyncingAll(false);
      loadLogs();
    }
  };

  const handleTestTelegram = async () => {
    if (!token) {
      showToast('❌ Потрібен GitHub Token у налаштуваннях');
      return;
    }
    setTestingTelegram(true);
    showToast('📨 Відправляємо запит на тестове сповіщення в Telegram...');
    try {
      await api.saveFile('src/test-telegram.flag', new Date().toISOString(), null, 'trigger: test telegram notification');
      await api.triggerWorkflow();
      showToast('🚀 Запит передано! Зачекайте ~30-40 сек — бот надішле сповіщення у ваш Telegram.');
    } catch (e) {
      showToast('❌ Помилка: ' + (e?.message || ''));
    } finally {
      setTestingTelegram(false);
    }
  };

  const toggleWhitelist = (vendorCode) => {
    setWhitelist(prev => prev.includes(vendorCode) ? prev.filter(v => v !== vendorCode) : [...prev, vendorCode]);
  };

  const toggleAvailability = (vendorCode) => {
    setAvailabilityOverrides(prev => {
      const next = { ...prev };
      if (next[vendorCode] === false) {
        // Якщо було false, робимо true (або видаляємо, щоб бралося з Хорошопу)
        // Для надійності поставимо true
        next[vendorCode] = true;
      } else {
        next[vendorCode] = false;
      }
      return next;
    });
  };

  const updateStock = (vendorCode, amount) => {
    // If empty string (during typing), just save it in UI state. 
    // It will be forced to 10 on blur, but let's also ensure Save handles it.
    setStockOverrides(prev => ({ ...prev, [vendorCode]: amount === '' ? '' : parseInt(amount) || 0 }));
  };

  const updateName = (vendorCode, originalName, newName) => {
    setNames(prev => {
      const next = { ...prev };
      if (newName === originalName || newName.trim() === '') {
        delete next[vendorCode];
      } else {
        next[vendorCode] = newName;
      }
      return next;
    });
  };

  const allSelected = catalog.length > 0 && catalog.every(p => whitelist.includes(p.vendorCode));
  const handleToggleAll = () => setWhitelist(allSelected ? [] : catalog.map(p => p.vendorCode));

  const handleSync = async () => {
    setSyncing(true);
    showToast('⏳ Запущено оновлення з Хорошопу. Це займе ~30-40 секунд...');
    try {
      await api.triggerWorkflow();
      // Wait for 35 seconds to allow GitHub Actions to finish
      await new Promise(r => setTimeout(r, 35000));
      await loadData();
      showToast('✅ Дані успішно оновлено!');
    } catch (e) {
      console.error(e);
      showToast('❌ Помилка оновлення. Спробуйте пізніше.');
    } finally {
      setSyncing(false);
      loadLogs(); // Refresh logs after sync attempt
    }
  };

  const updateBarcode = (vendorCode, value) => setBarcodes(prev => ({ ...prev, [vendorCode]: value }));
  const updateDescription = (vendorCode, value) => {
    setDescriptions(prev => {
      const next = { ...prev };
      if (value === undefined || value === null) {
        delete next[vendorCode];
      } else {
        next[vendorCode] = value;
      }
      return next;
    });
  };
  const updateVideo = (vendorCode, value) => {
    setVideos(prev => {
      const next = { ...prev };
      if (!value) delete next[vendorCode];
      else next[vendorCode] = value;
      return next;
    });
  };
  const copyToClipboard = (text) => { navigator.clipboard.writeText(text); showToast('📋 Посилання скопійовано!'); };

  const toggleCategory = (cat) => setCollapsedCategories(prev => {
    const isCurrentlyCollapsed = prev[cat] !== false;
    return { ...prev, [cat]: !isCurrentlyCollapsed };
  });

  // handle bulk select/deselect of searched items
  const handleBulkAction = (turnOn) => {
    const codes = filteredCatalog.map(p => p.vendorCode);
    if (turnOn) {
      setWhitelist(prev => [...new Set([...prev, ...codes])]);
    } else {
      setWhitelist(prev => prev.filter(c => !codes.includes(c)));
    }
  };

  const getProductStock = (code, fallbackStock) => {
    if (stockOverrides[code] !== undefined) {
      const parsed = parseInt(stockOverrides[code], 10);
      return isNaN(parsed) || parsed < 0 ? 0 : parsed;
    }
    if (alwaysAvailable.includes(code)) return 10;
    const fb = fallbackStock !== undefined ? fallbackStock : 0;
    return isNaN(fb) || fb < 0 ? 0 : fb;
  };

  const isMissingInExcel = (product) => {
    const code = product?.vendorCode ? String(product.vendorCode).trim() : '';
    if (!code) return true;
    return stockOverrides[code] === undefined && stockOverrides[product.vendorCode] === undefined;
  };

  const monoStats = useMemo(() => {
    let enabledCount = 0;
    let noBarcodeCount = 0;
    let outOfStockHoroshopCount = 0;
    let noExcelCount = 0;

    catalog.forEach(p => {
      const code = p.vendorCode ? String(p.vendorCode).trim() : '';
      if (whitelist.includes(code) || (p.vendorCode && whitelist.includes(p.vendorCode))) enabledCount++;
      if (!barcodes[code] && !barcodes[p.vendorCode] && !p.barcode) noBarcodeCount++;
      if (isHoroshopOutOfStock(p)) outOfStockHoroshopCount++;
      if (!code || (stockOverrides[code] === undefined && stockOverrides[p.vendorCode] === undefined)) noExcelCount++;
    });

    return {
      total: catalog.length,
      enabled: enabledCount,
      noBarcode: noBarcodeCount,
      outOfStockHoroshop: outOfStockHoroshopCount,
      noExcel: noExcelCount
    };
  }, [catalog, whitelist, barcodes, stockOverrides]);

  const filteredStockChanges = useMemo(() => {
    let list = stockChanges || [];
    if (stockLogFilter === 'became_zero') {
      list = list.filter(item => item.type === 'became_zero' || item.newQty === 0);
    } else if (stockLogFilter === 'became_available') {
      list = list.filter(item => item.type === 'became_available' || (item.oldQty === 0 && item.newQty > 0));
    } else if (stockLogFilter === 'changed') {
      list = list.filter(item => item.type === 'changed' || (item.oldQty > 0 && item.newQty > 0));
    }

    if (stockLogSearch.trim()) {
      const q = stockLogSearch.toLowerCase().trim();
      list = list.filter(item => 
        (item.vendorCode && item.vendorCode.toLowerCase().includes(q)) ||
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q))
      );
    }
    return list;
  }, [stockChanges, stockLogFilter, stockLogSearch]);

  const filteredCatalog = useMemo(() => {
    let result = catalog;
    
    if (filterMode === 'enabled') {
      result = result.filter(p => whitelist.includes(p.vendorCode));
    } else if (filterMode === 'no_barcode') {
      result = result.filter(p => !barcodes[p.vendorCode] && !p.barcode);
    } else if (filterMode === 'out_of_stock_horoshop') {
      result = result.filter(p => isHoroshopOutOfStock(p));
    } else if (filterMode === 'no_excel') {
      result = result.filter(p => isMissingInExcel(p));
    }
    
    if (searchQuery.trim()) {
      const terms = searchQuery.trim().split(/\s+/).filter(Boolean);
      if (terms.length > 1) {
        const termsLower = terms.map(t => t.toLowerCase());
        result = result.filter(p => termsLower.includes(p.vendorCode?.toLowerCase()));
      } else {
        const q = terms[0].toLowerCase();
        result = result.filter(p =>
          p.name?.toLowerCase().includes(q) ||
          p.vendorCode?.toLowerCase().includes(q) ||
          String(p.price).includes(q)
        );
      }
    }
    return result;
  }, [catalog, searchQuery, filterMode, whitelist, barcodes, stockOverrides]);

  const grouped = useMemo(() => {
    const map = {};
    let baseCatalog = catalog;
    if (filterMode === 'enabled') {
      baseCatalog = catalog.filter(p => whitelist.includes(p.vendorCode));
    } else if (filterMode === 'no_barcode') {
      baseCatalog = catalog.filter(p => !barcodes[p.vendorCode] && !p.barcode);
    } else if (filterMode === 'out_of_stock_horoshop') {
      baseCatalog = catalog.filter(p => isHoroshopOutOfStock(p));
    } else if (filterMode === 'no_excel') {
      baseCatalog = catalog.filter(p => isMissingInExcel(p));
    }
    for (const product of baseCatalog) {
      const cat = product.category || 'Без категорії';
      if (!map[cat]) map[cat] = [];
      map[cat].push(product);
    }
    return Object.entries(map).sort(([catA], [catB]) => catA.localeCompare(catB, 'uk'));
  }, [catalog, filterMode, whitelist, barcodes, stockOverrides]);

  const getCategoryStats = (products) => {
    const selected = products.filter(p => whitelist.includes(p.vendorCode)).length;
    return { selected, total: products.length };
  };

  // Calculate days_to_dispatch dynamically (same logic as convert.js)
  const getDaysToDispatch = () => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Kyiv' }));
    const day = now.getDay();
    if (day === 5) return 3; // Friday
    if (day === 6) return 2; // Saturday
    return 1;               // All other days
  };
  const daysToDispatch = getDaysToDispatch();
  const daysColor = daysToDispatch === 3 ? '#f59e0b' : daysToDispatch === 2 ? '#0ea5e9' : '#10b981';

  const handleExportExcel = () => {
    const data = catalog.map(p => {
      const stock = getProductStock(p.vendorCode, p.stock);
      const stockStatus = stock > 0 ? 'В наявності' : 'Немає в наявності';

      return {
        'Артикул': p.vendorCode,
        'Назва': names[p.vendorCode] !== undefined ? names[p.vendorCode] : p.name,
        'Категорія': p.category || 'Без категорії',
        'Наявність на складі': stockStatus,
        'Залишок на складі (шт)': stock,
        'Увімкнено для Мономаркету (так/ні)': whitelist.includes(p.vendorCode) ? 'так' : 'ні',
        'Наявність на Мономаркеті (так/ні)': availabilityOverrides[p.vendorCode] !== false ? 'так' : 'ні',
        'Штрихкод': barcodes[p.vendorCode] || ''
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Товари");
    XLSX.writeFile(workbook, "monomarket_products.xlsx");
  };

  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        let newWhitelist = [...whitelist];
        let newNames = { ...names };
        let newAvailability = { ...availabilityOverrides };
        let newBarcodes = { ...barcodes };
        let newStock = { ...stockOverrides };
        
        let updatedCount = 0;

        data.forEach(row => {
          const vendorCode = row['Артикул'] ? String(row['Артикул']) : null;
          if (!vendorCode) return;
          
          updatedCount++;
          
          if (row['Назва'] !== undefined) {
             const originalProduct = catalog.find(p => p.vendorCode === vendorCode);
             if (originalProduct && originalProduct.name !== row['Назва']) {
                newNames[vendorCode] = row['Назва'];
             } else if (originalProduct && originalProduct.name === row['Назва']) {
                delete newNames[vendorCode];
             } else if (!originalProduct) {
                newNames[vendorCode] = row['Назва'];
             }
          }
          
          const includeVal = row['Увімкнено для Мономаркету (так/ні)'];
          if (includeVal) {
             const isIncluded = String(includeVal).toLowerCase() === 'так' || String(includeVal).toLowerCase() === 'yes' || String(includeVal) === '1' || String(includeVal).toLowerCase() === 'true';
             if (isIncluded && !newWhitelist.includes(vendorCode)) {
                 newWhitelist.push(vendorCode);
             } else if (!isIncluded && newWhitelist.includes(vendorCode)) {
                 newWhitelist = newWhitelist.filter(v => v !== vendorCode);
             }
          }
          
          const availableVal = row['Наявність на Мономаркеті (так/ні)'];
          if (availableVal) {
             const isAvailable = String(availableVal).toLowerCase() === 'так' || String(availableVal).toLowerCase() === 'yes' || String(availableVal) === '1' || String(availableVal).toLowerCase() === 'true';
             if (!isAvailable) {
                 newAvailability[vendorCode] = false;
             } else {
                 newAvailability[vendorCode] = true; 
             }
          }

          if (row['Залишок на складі (шт)'] !== undefined && row['Залишок на складі (шт)'] !== '') {
            const parsedStock = parseInt(row['Залишок на складі (шт)'], 10);
            if (!isNaN(parsedStock)) {
              newStock[vendorCode] = parsedStock;
            }
          } else if (row['Наявність на складі'] !== undefined && row['Наявність на складі'] !== '') {
            const availText = String(row['Наявність на складі']).toLowerCase();
            if (availText.includes('немає') || availText === 'ні' || availText === 'no' || availText === '0') {
              newStock[vendorCode] = 0;
            }
          }

          if (row['Штрихкод'] !== undefined) {
             if (row['Штрихкод']) {
                 newBarcodes[vendorCode] = String(row['Штрихкод']);
             } else {
                 delete newBarcodes[vendorCode];
             }
          }
        });

        // Check for stock changes
        const detectedImportChanges = [];
        const nowIso = new Date().toISOString();
        for (const [code, newQty] of Object.entries(newStock)) {
          const oldQty = stockOverrides[code];
          if (oldQty !== undefined && oldQty !== newQty) {
            let type = 'changed';
            if (oldQty > 0 && newQty === 0) type = 'became_zero';
            else if (oldQty === 0 && newQty > 0) type = 'became_available';

            const prod = catalog.find(p => p.vendorCode === code) || {};
            detectedImportChanges.push({
              id: `${code}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              timestamp: nowIso,
              vendorCode: code,
              name: newNames[code] || names[code] || prod.name || code,
              category: prod.category || '',
              price: prod.price || '',
              oldQty,
              newQty,
              diff: newQty - oldQty,
              type
            });
          }
        }
        if (detectedImportChanges.length > 0) {
          const updatedChanges = [...detectedImportChanges, ...stockChanges].slice(0, 500);
          setStockChanges(updatedChanges);
          api.saveFile('src/stock-changes.json', JSON.stringify(updatedChanges, null, 2), shas.stockChanges, 'Оновлено журнал змін через імпорт Excel').catch(console.error);
        }

        setWhitelist(newWhitelist);
        setNames(newNames);
        setAvailabilityOverrides(newAvailability);
        setBarcodes(newBarcodes);
        setStockOverrides(newStock);

        showToast(`✅ Успішно оновлено ${updatedCount} товарів з Excel. Не забудьте натиснути "Зберегти зміни".`);
      } catch (err) {
        console.error(err);
        showToast('❌ Помилка імпорту файлу Excel.');
      }
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const renderPromProductRow = (product) => {
    const code = product.vendorCode ? String(product.vendorCode).trim() : '';
    const isEnabled = promWhitelistSet.has(code);
    const existsOnProm = promSkusSet.has(code);
    let stock = stockOverrides[code] !== undefined ? parseInt(stockOverrides[code], 10) : 0;
    if (alwaysAvailable.includes(code)) stock = Math.max(stock, 10);
    if (isNaN(stock) || stock < 0) stock = 0;

    return (
      <tr
        key={product.id || code}
        style={{
          borderBottom: '1px solid var(--border-color)',
          background: !existsOnProm ? 'rgba(254, 243, 199, 0.28)' : (!isEnabled ? 'rgba(243, 244, 246, 0.5)' : (stock > 0 ? 'transparent' : 'rgba(254, 242, 242, 0.25)')),
          transition: 'background 0.2s'
        }}
      >
        <td style={{ padding: '0.85rem', textAlign: 'center' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', cursor: !existsOnProm ? 'not-allowed' : 'pointer', gap: '0.4rem' }}>
            <input
              type="checkbox"
              disabled={!existsOnProm}
              title={!existsOnProm ? 'Товару ще немає на Prom.ua' : ''}
              checked={isEnabled && existsOnProm}
              onChange={() => togglePromWhitelist(code)}
              style={{ width: '20px', height: '20px', cursor: !existsOnProm ? 'not-allowed' : 'pointer', accentColor: '#8b5cf6', opacity: !existsOnProm ? 0.35 : 1 }}
            />
          </label>
        </td>
        <td style={{ padding: '0.85rem', textAlign: 'center' }}>
          {product.picture ? (
            <img
              src={product.picture}
              alt=""
              style={{ width: '42px', height: '42px', objectFit: 'contain', borderRadius: '4px', border: '1px solid var(--border-color)', background: '#fff' }}
              loading="lazy"
            />
          ) : (
            <div style={{ width: '42px', height: '42px', background: '#e5e7eb', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: '#9ca3af' }}>—</div>
          )}
        </td>
        <td style={{ padding: '0.85rem' }}>
          <code style={{ background: '#f1f5f9', padding: '0.2rem 0.45rem', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600 }}>
            {code}
          </code>
        </td>
        <td style={{ padding: '0.85rem' }}>
          <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
            <span>{names[code] || product.name}</span>
            {isHoroshopOutOfStock(product) && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.75rem',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  background: '#fee2e2',
                  color: '#b91c1c',
                  fontWeight: 600,
                  whiteSpace: 'nowrap'
                }}
                title="Хорошоп передає статус товару: Немає в наявності (available=false)"
              >
                ⚠️ Немає в наявності на Хорошопі
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {product.category || 'Без категорії'}
          </div>
        </td>
        <td style={{ padding: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
          {product.price ? `${Number(product.price).toLocaleString()} ₴` : '—'}
        </td>
        <td style={{ padding: '0.85rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
          <span style={{
            display: 'inline-block',
            padding: '0.25rem 0.6rem',
            borderRadius: '6px',
            fontWeight: 700,
            fontSize: '0.9rem',
            background: stock > 0 ? '#dcfce7' : '#fee2e2',
            color: stock > 0 ? '#15803d' : '#b91c1c'
          }}>
            {stock} шт.
          </span>
        </td>
        <td style={{ padding: '0.85rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
            {!existsOnProm ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.55rem', borderRadius: '6px', background: stock > 0 ? '#fee2e2' : '#fef3c7', color: stock > 0 ? '#b91c1c' : '#92400e', fontSize: '0.8rem', fontWeight: 600 }} title="Товар є у фіді Хорошопу, але його артикул не знайдено на Prom.ua">
                {stock > 0 ? '🚨 Склад > 0, немає на Prom' : '⚠️ Немає на Prom.ua'}
              </span>
            ) : !isEnabled ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.55rem', borderRadius: '6px', background: stock > 0 ? '#ffedd5' : '#f3f4f6', color: stock > 0 ? '#c2410c' : '#4b5563', fontSize: '0.8rem', fontWeight: stock > 0 ? 600 : 500 }} title="Товар вимкнено для Prom: залишається видимим на сайті, але зі статусом 'Немає в наявності' (0 шт.)">
                {stock > 0 ? '⚪ Є на складі, але вимкнено' : '⚪ Вимкнено (Немає в наявн.)'}
              </span>
            ) : stock > 0 ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.55rem', borderRadius: '6px', background: '#dcfce7', color: '#166534', fontSize: '0.8rem', fontWeight: 600 }}>
                🟢 В наявності ({stock} шт.)
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.55rem', borderRadius: '6px', background: '#fee2e2', color: '#991b1b', fontSize: '0.8rem', fontWeight: 500 }}>
                🔴 Немає в наявності
              </span>
            )}

            {existsOnProm && stockOverrides[code] === undefined && (
              <span style={{ fontSize: '0.72rem', color: '#4338ca', background: '#e0e7ff', padding: '0.12rem 0.45rem', borderRadius: '4px', fontWeight: 600 }}>
                ❓ Немає в Excel-складі
              </span>
            )}
            {existsOnProm && isEnabled && stock > 0 && isHoroshopOutOfStock(product) && (
              <span style={{ fontSize: '0.72rem', color: '#b91c1c', background: '#fee2e2', padding: '0.12rem 0.45rem', borderRadius: '4px', fontWeight: 600 }}>
                ⚠️ На сайті Хорошоп: «Немає»
              </span>
            )}
          </div>
        </td>
      </tr>
    );
  };

  const renderHoroshopProductRow = (product) => {
    const item = getHoroshopItemData(product);
    const { code, stock, presenceMode, isAvailable, installmentsMode, hasInstallments } = item;

    return (
      <tr
        key={product.id || code}
        style={{
          borderBottom: '1px solid var(--border-color)',
          background: presenceMode === 'off'
            ? 'rgba(254, 242, 242, 0.45)'
            : presenceMode === 'on'
              ? 'rgba(236, 253, 245, 0.4)'
              : isAvailable
                ? 'transparent'
                : 'rgba(243, 244, 246, 0.4)',
          transition: 'background 0.2s'
        }}
      >
        {/* 1. Наявність на Хорошоп: Трипозиційний перемикач */}
        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
          <div style={{
            display: 'inline-flex',
            background: '#f1f5f9',
            borderRadius: '8px',
            padding: '2px',
            border: '1px solid #e2e8f0',
            gap: '1px'
          }}>
            <button
              type="button"
              onClick={() => setProductPresenceMode(code, 'off')}
              style={{
                padding: '4px 7px',
                fontSize: '0.74rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                background: presenceMode === 'off' ? '#ef4444' : 'transparent',
                color: presenceMode === 'off' ? '#ffffff' : '#64748b',
                boxShadow: presenceMode === 'off' ? '0 1px 2px rgba(239, 68, 68, 0.35)' : 'none',
                transition: 'all 0.15s ease'
              }}
              title="Примусово: Немає в наявності (товар не продається на Хорошоп)"
            >
              🔴 Немає
            </button>
            <button
              type="button"
              onClick={() => setProductPresenceMode(code, 'auto')}
              style={{
                padding: '4px 7px',
                fontSize: '0.74rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                background: presenceMode === 'auto' ? '#ffffff' : 'transparent',
                color: presenceMode === 'auto' ? '#0f172a' : '#64748b',
                boxShadow: presenceMode === 'auto' ? '0 1px 2px rgba(0, 0, 0, 0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
              title="Автоматично: за залишком на складі (>0 -> В наявності, 0 -> Немає)"
            >
              ⚡ Авто
            </button>
            <button
              type="button"
              onClick={() => setProductPresenceMode(code, 'on')}
              style={{
                padding: '4px 7px',
                fontSize: '0.74rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                background: presenceMode === 'on' ? '#10b981' : 'transparent',
                color: presenceMode === 'on' ? '#ffffff' : '#64748b',
                boxShadow: presenceMode === 'on' ? '0 1px 2px rgba(16, 185, 129, 0.35)' : 'none',
                transition: 'all 0.15s ease'
              }}
              title="Примусово: В наявності (продається завжди)"
            >
              🟢 Є
            </button>
          </div>
        </td>

        {/* 2. Оплата частинами (ОЧ): Трипозиційний перемикач */}
        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
          <div style={{
            display: 'inline-flex',
            background: '#f1f5f9',
            borderRadius: '8px',
            padding: '2px',
            border: '1px solid #e2e8f0',
            gap: '1px',
            opacity: presenceMode === 'off' ? 0.45 : 1
          }}>
            <button
              type="button"
              onClick={() => setProductInstallmentsMode(code, 'off')}
              style={{
                padding: '4px 7px',
                fontSize: '0.74rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                background: installmentsMode === 'off' ? '#ef4444' : 'transparent',
                color: installmentsMode === 'off' ? '#ffffff' : '#64748b',
                boxShadow: installmentsMode === 'off' ? '0 1px 2px rgba(239, 68, 68, 0.35)' : 'none',
                transition: 'all 0.15s ease'
              }}
              title="Заборонити ОЧ: Оплата частинами ніколи не передається"
            >
              🔴 Заборона
            </button>
            <button
              type="button"
              onClick={() => setProductInstallmentsMode(code, 'auto')}
              style={{
                padding: '4px 7px',
                fontSize: '0.74rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                background: installmentsMode === 'auto' ? '#ffffff' : 'transparent',
                color: installmentsMode === 'auto' ? '#0f172a' : '#64748b',
                boxShadow: installmentsMode === 'auto' ? '0 1px 2px rgba(0, 0, 0, 0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
              title="Автоматично: ОЧ дозволена тільки якщо товар в наявності та залишок > 0"
            >
              ⚡ Авто
            </button>
            <button
              type="button"
              onClick={() => setProductInstallmentsMode(code, 'on')}
              style={{
                padding: '4px 7px',
                fontSize: '0.74rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                background: installmentsMode === 'on' ? '#8b5cf6' : 'transparent',
                color: installmentsMode === 'on' ? '#ffffff' : '#64748b',
                boxShadow: installmentsMode === 'on' ? '0 1px 2px rgba(139, 92, 246, 0.35)' : 'none',
                transition: 'all 0.15s ease'
              }}
              title="Примусово ОЧ: Оплата частинами завжди увімкнена (навіть при 0 шт.)"
            >
              🟣 Примусово
            </button>
          </div>
        </td>

        {/* Фото */}
        <td style={{ padding: '0.85rem', textAlign: 'center' }}>
          {product.picture ? (
            <img
              src={product.picture}
              alt=""
              style={{ width: '42px', height: '42px', objectFit: 'contain', borderRadius: '4px', border: '1px solid var(--border-color)', background: '#fff' }}
              loading="lazy"
            />
          ) : (
            <div style={{ width: '42px', height: '42px', background: '#e5e7eb', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: '#9ca3af' }}>—</div>
          )}
        </td>

        {/* Артикул */}
        <td style={{ padding: '0.85rem' }}>
          <code style={{ background: '#f1f5f9', padding: '0.2rem 0.45rem', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600 }}>
            {code}
          </code>
        </td>

        {/* Назва */}
        <td style={{ padding: '0.85rem' }}>
          <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
            <span>{names[code] || product.name}</span>
            {isHoroshopOutOfStock(product) && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.75rem',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  background: '#fee2e2',
                  color: '#b91c1c',
                  fontWeight: 600,
                  whiteSpace: 'nowrap'
                }}
                title="Хорошоп передає статус товару: Немає в наявності (available=false)"
              >
                ⚠️ На сайті: «Немає»
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {product.category || 'Без категорії'}
          </div>
        </td>

        {/* Ціна */}
        <td style={{ padding: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
          {product.price ? `${Number(product.price).toLocaleString()} ₴` : '—'}
        </td>

        {/* Склад (Excel) */}
        <td style={{ padding: '0.85rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
          <span style={{
            display: 'inline-block',
            padding: '0.25rem 0.6rem',
            borderRadius: '6px',
            fontWeight: 700,
            fontSize: '0.9rem',
            background: stock > 0 ? '#dcfce7' : '#fee2e2',
            color: stock > 0 ? '#15803d' : '#b91c1c'
          }}>
            {stock} шт.
          </span>
        </td>

        {/* Підсумковий статус */}
        <td style={{ padding: '0.85rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-start' }}>
            {/* Presence status */}
            {presenceMode === 'off' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.55rem', borderRadius: '5px', background: '#fee2e2', color: '#b91c1c', fontSize: '0.8rem', fontWeight: 600 }}>
                🔴 Немає на Хорошоп (примусово)
              </span>
            ) : presenceMode === 'on' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.55rem', borderRadius: '5px', background: '#dcfce7', color: '#166534', fontSize: '0.8rem', fontWeight: 600 }}>
                🟢 В наявності (примусово)
              </span>
            ) : isAvailable ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.55rem', borderRadius: '5px', background: '#dcfce7', color: '#166534', fontSize: '0.8rem', fontWeight: 600 }}>
                🟢 В наявності (склад: {stock})
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.55rem', borderRadius: '5px', background: '#f3f4f6', color: '#6b7280', fontSize: '0.8rem', fontWeight: 500 }}>
                ⚪ Немає на складі (0 шт.)
              </span>
            )}

            {/* Installments status */}
            {presenceMode === 'off' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: '#f3f4f6', color: '#9ca3af', fontSize: '0.75rem' }}>
                🚫 ОЧ вимкнено (товар приховано)
              </span>
            ) : installmentsMode === 'off' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: '#fee2e2', color: '#b91c1c', fontSize: '0.75rem', fontWeight: 600 }}>
                🚫 ОЧ заборонено
              </span>
            ) : installmentsMode === 'on' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: '#f3e8ff', color: '#6b21a8', fontSize: '0.75rem', fontWeight: 600 }}>
                💳 Примусово ОЧ (6 пл.)
              </span>
            ) : hasInstallments ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: '#dcfce7', color: '#15803d', fontSize: '0.75rem', fontWeight: 600 }}>
                💳 ОЧ активна (6 пл.)
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: '#f3f4f6', color: '#6b7280', fontSize: '0.75rem' }}>
                ⚪ ОЧ вимкнено (0 на складі)
              </span>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="layout-wrapper">
      <div className="sidebar">
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              background: '#2563eb',
              color: 'white',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '1rem',
              boxShadow: '0 2px 4px rgba(37,99,235,0.3)'
            }}>
              ⚡
            </div> 
            <span style={{ fontWeight: 800, fontSize: '1.15rem', color: '#0f172a', letterSpacing: '-0.02em' }}>
              CRM PRO
            </span>
          </div>
          <span style={{ color: '#94a3b8', fontSize: '0.9rem', cursor: 'pointer' }} title="Згорнути">«</span>
        </div>

        {/* Sidebar Navigation Menu */}
        <div className="sidebar-menu" style={{ flex: 1 }}>
          <a className={`sidebar-item prom ${activeTab === 'prom' ? 'active' : ''}`} onClick={() => setActiveTab('prom')}>
            <span style={{ fontSize: '1.05rem' }}>🏪</span> Prom.ua
          </a>
          <a className={`sidebar-item horoshop ${activeTab === 'horoshop' ? 'active' : ''}`} onClick={() => setActiveTab('horoshop')}>
            <span style={{ fontSize: '1.05rem' }}>📦</span> Хорошоп
          </a>
          <a className={`sidebar-item mono ${activeTab === 'catalog' ? 'active' : ''}`}
            onClick={() => setActiveTab('catalog')}
          >
            <span style={{ fontSize: '1.05rem' }}>🐾</span> Мономаркет
          </a>
          <a
            className={`sidebar-item stock-log ${showStockLog ? 'active' : ''}`}
            onClick={openStockLog}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.05rem' }}>🔔</span>
              <span>Зміни залишків</span>
            </div>
            {unreadStockCount > 0 && (
              <span style={{
                background: '#dc2626',
                color: '#ffffff',
                fontSize: '0.7rem',
                fontWeight: 800,
                borderRadius: '999px',
                padding: '0.1rem 0.45rem',
                lineHeight: 1.2
              }}>
                {unreadStockCount}
              </span>
            )}
          </a>
          <a className="sidebar-item" onClick={() => { setShowLogs(true); loadLogs(); }}>
            <span style={{ fontSize: '1.05rem' }}>⏱️</span> Logs
          </a>
          <a className="sidebar-item" onClick={() => setShowLinks(true)}>
            <span style={{ fontSize: '1.05rem' }}>&lt;/&gt;</span> XML Feeds
          </a>

          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', margin: '1.25rem 0 0.5rem 0.5rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            CONNECTORS
          </div>
          <a className={`sidebar-item import ${activeTab === 'import' ? 'active' : ''}`} onClick={() => setActiveTab('import')}>
            <span style={{ fontSize: '1.05rem' }}>📥</span> Excel Import
          </a>
          <a className="sidebar-item" onClick={() => setShowSettings(true)}>
            <span style={{ fontSize: '1.05rem' }}>⚙️</span> Settings
          </a>
        </div>

        {/* Logout at bottom of Sidebar */}
        <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
          <button
            onClick={() => { localStorage.removeItem('panel_auth'); window.location.reload(); }}
            title="Вийти з акаунту"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.65rem 0.85rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#ef4444',
              background: '#fef2f2',
              border: '1px solid #fee2e2',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#fee2e2';
              e.currentTarget.style.borderColor = '#fca5a5';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#fef2f2';
              e.currentTarget.style.borderColor = '#fee2e2';
            }}
          >
            <span style={{ fontSize: '1.05rem' }}>🚪</span>
            <span>Вийти з акаунту</span>
          </button>
        </div>
      </div>

      <div className="container">
              {/* Global Action Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.6rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <button
            className="btn"
            style={{
              background: unreadStockCount > 0 ? '#fff1f2' : '#ffffff',
              color: unreadStockCount > 0 ? '#dc2626' : '#1e293b',
              border: unreadStockCount > 0 ? '1px solid #fecdd3' : '1px solid #e2e8f0',
              padding: '0.55rem 1rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: unreadStockCount > 0 ? '0 1px 3px rgba(220, 38, 38, 0.15)' : 'none'
            }}
            onClick={openStockLog}
            title="Журнал останніх змін кількості товару в Google Таблицях"
          >
            <span>🔔</span>
            <span>Зміни залишків</span>
            {unreadStockCount > 0 && (
              <span style={{
                background: '#dc2626',
                color: '#ffffff',
                fontSize: '0.72rem',
                fontWeight: 800,
                borderRadius: '999px',
                padding: '0.15rem 0.45rem',
                lineHeight: 1
              }}>
                {unreadStockCount}
              </span>
            )}
          </button>
          <button
            className="btn"
            style={{
              background: '#2563eb',
              color: '#ffffff',
              fontWeight: 600,
              padding: '0.55rem 1.15rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              boxShadow: '0 1px 3px rgba(37, 99, 235, 0.3)'
            }}
            onClick={handleTriggerFullSync}
            disabled={syncingAll || loading || !token}
            title="Запустити повний цикл оновлення (Excel -> Prom -> Хорошоп -> Моно)"
          >
            {syncingAll ? <span className="loader" style={{ width: '16px', height: '16px' }}></span> : '⚡ Повна синхронізація всього'}
          </button>
          <button
            className="btn"
            style={{
              background: '#ffffff',
              color: '#1e293b',
              border: '1px solid #e2e8f0',
              padding: '0.55rem 1rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 500
            }}
            onClick={loadData}
            disabled={loading}
            title="Перезавантажити дані з GitHub"
          >
            {loading ? <span className="loader" style={{ width: '16px', height: '16px', borderColor: 'rgba(0,0,0,0.2)', borderTopColor: '#000' }}></span> : '🔄 Оновити дані'}
          </button>
          <button
            className="btn"
            style={{
              background: '#ffffff',
              color: '#475569',
              border: '1px solid #e2e8f0',
              padding: '0.55rem',
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={() => setShowSettings(true)}
            title="Налаштування"
          >
            ⚙️
          </button>
        </div>

        {activeTab === 'prom' ? (
        <div className="header">
          <div>
            <h1>🟣 Керування товарами Prom.ua</h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Синхронізація наявності та залишків через Prom API</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              className="btn"
              style={{ background: '#8b5cf6', color: '#fff' }}
              onClick={handleTriggerPromSync}
              disabled={syncingProm || loading || savingProm || !token}
              title="Запустити синхронізацію з Prom.ua через GitHub Actions"
            >
              {syncingProm ? <span className="loader"></span> : '⚡ Синхронізувати з Prom.ua'}
            </button>
            <button
              className="btn success"
              onClick={handleSaveProm}
              disabled={savingProm || syncingProm || loading || !token}
            >
              {savingProm ? <span className="loader"></span> : '💾 Зберегти зміни Prom'}
            </button>
          </div>
        </div>
      ) : activeTab === 'horoshop' ? (
        <div className="header">
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', background: '#eef2f9', color: '#4360a0', fontSize: '1.1rem', border: '1px solid #cbd7ee' }}>📦</span>
              Керування Хорошоп
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Оплата частинами (monobank) та статуси товарів по API</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              className="btn"
              style={{ background: '#4360a0', color: '#fff', boxShadow: '0 2px 4px rgba(67, 96, 160, 0.25)' }}
              onClick={handleTriggerHoroshopSync}
              disabled={syncingHoroshop || loading || savingHoroshop || !token}
              title="Запустити оновлення Хорошопу по API через GitHub Actions"
            >
              {syncingHoroshop ? <span className="loader"></span> : '⚡ Оновити Хорошоп зараз'}
            </button>
            <button
              className="btn success"
              onClick={handleSaveHoroshop}
              disabled={savingHoroshop || syncingHoroshop || loading || !token}
            >
              {savingHoroshop ? <span className="loader"></span> : '💾 Зберегти зміни Хорошоп'}
            </button>
          </div>
        </div>
      ) : (
        <div className="header">
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', background: '#18181b', color: '#ffffff', fontSize: '1.1rem' }}>🐾</span>
              Керування Мономаркет
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Товарний фід та налаштування для маркетплейсу monobank</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="btn" style={{ background: '#4360a0', color: '#fff' }} onClick={handleSync} disabled={syncing || loading || saving || !token} title="Оновити залишки та товари з Хорошопу">
              {syncing ? <span className="loader"></span> : '🔄 Оновити з Хорошопу'}
            </button>
            <button className="btn" style={{ background: '#18181b', color: '#ffffff', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} onClick={handleTriggerFeed} disabled={syncing || loading || saving || !token} title="Запустити генерацію фіду без збереження">
              {syncing ? <span className="loader"></span> : `⚡ Запустити фід (${daysToDispatch}д)`}
            </button>
            <button className="btn success" onClick={handleSaveAll} disabled={saving || syncing || loading || !token}>
              {saving ? <span className="loader"></span> : '💾 Зберегти зміни'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'prom' ? (
        <div className="stats-grid">
          <div
            className="stat-card"
            style={{ cursor: 'pointer', border: promFilterMode === 'all' ? '2px solid #8b5cf6' : '1px solid var(--border-color)', transition: 'all 0.2s', background: promFilterMode === 'all' ? '#f5f3ff' : 'transparent' }}
            onClick={() => setPromFilterMode('all')}
            title="Показати всі товари"
          >
            <div className="stat-label">Всього в каталозі</div>
            <div className="stat-value">{promStats.total}</div>
          </div>
          <div
            className="stat-card"
            style={{ cursor: 'pointer', border: promFilterMode === 'enabled' ? '2px solid #8b5cf6' : '1px solid var(--border-color)', transition: 'all 0.2s', background: promFilterMode === 'enabled' ? '#f5f3ff' : 'transparent' }}
            onClick={() => setPromFilterMode(promFilterMode === 'enabled' ? 'all' : 'enabled')}
            title="Фільтр: увімкнені для Prom.ua"
          >
            <div className="stat-label">Увімкнено для Prom.ua</div>
            <div className="stat-value" style={{ color: '#8b5cf6' }}>{promStats.enabled}</div>
          </div>
          <div
            className="stat-card"
            style={{ cursor: 'pointer', border: promFilterMode === 'in_stock' ? '2px solid var(--success)' : '1px solid var(--border-color)', transition: 'all 0.2s', background: promFilterMode === 'in_stock' ? '#f0fdf4' : 'transparent' }}
            onClick={() => setPromFilterMode(promFilterMode === 'in_stock' ? 'all' : 'in_stock')}
            title="Фільтр: в наявності"
          >
            <div className="stat-label">В наявності (готовий до відправки)</div>
            <div className="stat-value" style={{ color: 'var(--success)' }}>{promStats.inStock}</div>
          </div>
          <div
            className="stat-card"
            style={{ cursor: 'pointer', border: promFilterMode === 'out_of_stock' ? '2px solid var(--danger)' : '1px solid var(--border-color)', transition: 'all 0.2s', background: promFilterMode === 'out_of_stock' ? '#fef2f2' : 'transparent' }}
            onClick={() => setPromFilterMode(promFilterMode === 'out_of_stock' ? 'all' : 'out_of_stock')}
            title="Фільтр: немає в наявності"
          >
            <div className="stat-label">Немає в наявності (0 шт.)</div>
            <div className="stat-value" style={{ color: 'var(--danger)' }}>{promStats.outOfStock}</div>
          </div>
          <div
            className="stat-card"
            style={{ cursor: 'pointer', border: promFilterMode === 'no_match' ? '2px solid #d97706' : '1px solid var(--border-color)', transition: 'all 0.2s', background: promFilterMode === 'no_match' ? '#fffbeb' : 'transparent' }}
            onClick={() => setPromFilterMode(promFilterMode === 'no_match' ? 'all' : 'no_match')}
            title="Фільтр: немає збігу артикулу з Prom.ua"
          >
            <div className="stat-label">⚠️ Немає збігу артикулу</div>
            <div className="stat-value" style={{ color: '#d97706' }}>{promStats.noMatch}</div>
          </div>
          <div
            className="stat-card"
            style={{ cursor: 'pointer', border: promFilterMode === 'disabled' ? '2px solid var(--text-muted)' : '1px solid var(--border-color)', transition: 'all 0.2s', background: promFilterMode === 'disabled' ? '#f9fafb' : 'transparent' }}
            onClick={() => setPromFilterMode(promFilterMode === 'disabled' ? 'all' : 'disabled')}
            title="Фільтр: вимкнено з Prom (статус 'Немає в наявності', видимий)"
          >
            <div className="stat-label">Вимкнено (Немає в наявн.)</div>
            <div className="stat-value" style={{ color: 'var(--text-muted)' }}>{promStats.disabled}</div>
          </div>
        </div>
      ) : activeTab === 'horoshop' ? (
        <div className="stats-grid">
          <div
            className="stat-card"
            style={{ cursor: 'pointer', border: horoshopFilterMode === 'all' ? '2px solid #4360a0' : '1px solid var(--border-color)', transition: 'all 0.2s', background: horoshopFilterMode === 'all' ? '#eef2f9' : 'transparent' }}
            onClick={() => setHoroshopFilterMode('all')}
            title="Показати всі товари"
          >
            <div className="stat-label">Всього в каталозі</div>
            <div className="stat-value" style={{ color: horoshopFilterMode === 'all' ? '#4360a0' : 'var(--text-main)' }}>{horoshopStats.total}</div>
          </div>
          <div
            className="stat-card"
            style={{ cursor: 'pointer', border: horoshopFilterMode === 'presence_in_stock' ? '2px solid var(--success)' : '1px solid var(--border-color)', transition: 'all 0.2s', background: horoshopFilterMode === 'presence_in_stock' ? '#f0fdf4' : 'transparent' }}
            onClick={() => setHoroshopFilterMode(horoshopFilterMode === 'presence_in_stock' ? 'all' : 'presence_in_stock')}
            title="Фільтр: В наявності на Хорошопі"
          >
            <div className="stat-label">🟢 В наявності на Хорошоп</div>
            <div className="stat-value" style={{ color: 'var(--success)' }}>{horoshopStats.inStock}</div>
          </div>
          <div
            className="stat-card"
            style={{ cursor: 'pointer', border: horoshopFilterMode === 'presence_off' ? '2px solid #ef4444' : '1px solid var(--border-color)', transition: 'all 0.2s', background: horoshopFilterMode === 'presence_off' ? '#fef2f2' : 'transparent' }}
            onClick={() => setHoroshopFilterMode(horoshopFilterMode === 'presence_off' ? 'all' : 'presence_off')}
            title="Фільтр: Примусово немає в наявності"
          >
            <div className="stat-label">🔴 Примусово немає (знято)</div>
            <div className="stat-value" style={{ color: '#ef4444' }}>{horoshopStats.forcedOutOfStock}</div>
          </div>
          <div
            className="stat-card"
            style={{ cursor: 'pointer', border: horoshopFilterMode === 'installments_active' ? '2px solid #8b5cf6' : '1px solid var(--border-color)', transition: 'all 0.2s', background: horoshopFilterMode === 'installments_active' ? '#f5f3ff' : 'transparent' }}
            onClick={() => setHoroshopFilterMode(horoshopFilterMode === 'installments_active' ? 'all' : 'installments_active')}
            title="Фільтр: Оплата частинами активна (6 пл.)"
          >
            <div className="stat-label">💳 Оплата частинами (6 пл.)</div>
            <div className="stat-value" style={{ color: '#8b5cf6' }}>{horoshopStats.active}</div>
          </div>
          <div
            className="stat-card"
            style={{ cursor: 'pointer', border: horoshopFilterMode === 'installments_disabled' ? '2px solid var(--text-muted)' : '1px solid var(--border-color)', transition: 'all 0.2s', background: horoshopFilterMode === 'installments_disabled' ? '#f9fafb' : 'transparent' }}
            onClick={() => setHoroshopFilterMode(horoshopFilterMode === 'installments_disabled' ? 'all' : 'installments_disabled')}
            title="Фільтр: ОЧ заборонено"
          >
            <div className="stat-label">🚫 ОЧ заборонено вручну</div>
            <div className="stat-value" style={{ color: 'var(--text-muted)' }}>{horoshopStats.disabled}</div>
          </div>
        </div>
      ) : (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Всього товарів</div>
            <div className="stat-value">{catalog.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Відмічено для Мономаркету</div>
            <div className="stat-value" style={{ color: '#18181b' }}>{whitelist.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Категорій</div>
            <div className="stat-value">{grouped.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Штрихкодів</div>
            <div className="stat-value">{Object.keys(barcodes).length}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      {(activeTab === 'catalog' || activeTab === 'import') && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <button 
            onClick={() => setActiveTab('catalog')}
            style={{ padding: '0.75rem 1.5rem', background: 'none', border: 'none', borderBottom: activeTab === 'catalog' ? '2px solid #18181b' : '2px solid transparent', color: activeTab === 'catalog' ? '#18181b' : 'var(--text-main)', cursor: 'pointer', fontWeight: 600, fontSize: '1rem', transition: 'all 0.2s' }}
          >
            🐾 Каталог Мономаркет
          </button>
          <button 
            onClick={() => setActiveTab('import')}
            style={{ padding: '0.75rem 1.5rem', background: 'none', border: 'none', borderBottom: activeTab === 'import' ? '2px solid #059669' : '2px solid transparent', color: activeTab === 'import' ? '#059669' : 'var(--text-main)', cursor: 'pointer', fontWeight: 600, fontSize: '1rem', transition: 'all 0.2s' }}
          >
            📥 Імпорт / Експорт (Excel)
          </button>
        </div>
      )}

      
      {activeTab === 'import' && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ maxWidth: '600px' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.5rem' }}>📊</span> Експорт та імпорт даних
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: '1.5' }}>
              Ви можете експортувати поточні налаштування товарів (штрихкоди, назви, наявність на складі, залишки та статус увімкнення) в Excel файл, масово відредагувати їх та імпортувати назад.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div style={{ padding: '1.5rem', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '0.75rem' }}>
                <h3 style={{ marginTop: 0, marginBottom: '0.75rem', color: '#3b82f6' }}>1. Експорт даних</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Завантажити всі товари з поточними змінами у форматі XLSX.</p>
                <button className="btn" style={{ background: '#3b82f6', color: '#fff' }} onClick={handleExportExcel}>
                  📥 Завантажити Excel
                </button>
              </div>

              <div style={{ padding: '1.5rem', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '0.75rem' }}>
                <h3 style={{ marginTop: 0, marginBottom: '0.75rem', color: '#10b981' }}>2. Імпорт даних</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Виберіть відредагований Excel файл, щоб застосувати нові налаштування.</p>
                <input 
                  type="file" 
                  accept=".xlsx, .xls" 
                  onChange={handleImportExcel}
                  id="excel-upload"
                  style={{ display: 'none' }}
                />
                <label htmlFor="excel-upload" className="btn success" style={{ display: 'inline-block', cursor: 'pointer', textAlign: 'center' }}>
                  📤 Вибрати файл Excel
                </label>
                <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#f59e0b', margin: '1rem 0 0' }}>
                  ⚠️ Увага: Після успішного імпорту натисніть кнопку "Зберегти зміни" вгорі сторінки, щоб застосувати їх.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: activeTab === 'catalog' ? 'block' : 'none' }}>
      {/* Search and Filters */}
      {!loading && catalog.length > 0 && (
        <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1.1rem', pointerEvents: 'none' }}>🔍</span>
            <input
              type="text"
              className="input-field"
              placeholder="Пошук за назвою або артикулом (можна вставити список артикулів)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.5rem', fontSize: '1rem' }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-muted)' }}
              >✕</button>
            )}
          </div>
          <select className="input-field" style={{ width: 'auto', minWidth: '260px', fontSize: '0.95rem', cursor: 'pointer' }} value={filterMode} onChange={e => setFilterMode(e.target.value)}>
            <option value="all">👁️ Усі товари ({catalog.length})</option>
            <option value="enabled">🟢 Тільки увімкнені в фід ({monoStats.enabled})</option>
            <option value="no_barcode">⚠️ Без штрихкоду ({monoStats.noBarcode})</option>
            <option value="out_of_stock_horoshop">⚠️ Немає в наявності на Хорошопі ({monoStats.outOfStockHoroshop})</option>
            <option value="no_excel">⚠️ Немає артикулу в Excel ({monoStats.noExcel})</option>
          </select>
          
        </div>
      )}

      {/* Плоскі результати пошуку */}
      {searchQuery.trim() && (
        <div className="glass-panel" style={{ marginBottom: '1rem', padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(24, 24, 27, 0.04)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700 }}>🔍 Результати пошуку</span>
            <span className="badge" style={{ background: '#18181b', color: '#ffffff' }}>{filteredCatalog.length} товарів</span>
            
            {filteredCatalog.length > 0 && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                <button className="btn" style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', background: '#18181b', color: '#ffffff' }} onClick={() => handleBulkAction(true)}>
                  ✅ Увімкнути всі {filteredCatalog.length}
                </button>
                <button className="btn" style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', background: 'var(--surface-color)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }} onClick={() => handleBulkAction(false)}>
                  ❌ Вимкнути всі
                </button>
              </div>
            )}
          </div>
          {filteredCatalog.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Нічого не знайдено</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ tableLayout: 'fixed', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>Увімк</th>
                    <th style={{ width: '90px' }}>Наявність</th>
                    <th style={{ width: '80px' }}>Залишок</th>
                    <th>Товар</th>
                    <th style={{ width: '55px', textAlign: 'center' }}>Дні</th>
                    <th style={{ width: '145px' }}>Штрихкод</th>
                    <th style={{ width: '155px' }}>Кастомний опис</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCatalog.map(product => {
                    const isSelected = whitelist.includes(product.vendorCode);
                    const isAvailable = availabilityOverrides[product.vendorCode] !== false;
                    return (
                      <tr key={product.vendorCode} style={{ opacity: isSelected ? 1 : 0.5 }}>
                        <td>
                          <label className="toggle-switch">
                            <input type="checkbox" checked={isSelected} onChange={() => toggleWhitelist(product.vendorCode)} />
                            <span className="slider"></span>
                          </label>
                        </td>
                        <td>
                          <label className="toggle-switch" style={{ opacity: isSelected ? 1 : 0.4 }}>
                            <input type="checkbox" checked={isAvailable} disabled={!isSelected} onChange={() => toggleAvailability(product.vendorCode)} />
                            <span className="slider" style={{ background: isAvailable ? '#10b981' : '#f87171' }}></span>
                          </label>
                        </td>
                        <td>
                          <input type="number" min="0" className="input-field" 
                            style={{ width: '100%', padding: '0.4rem', textAlign: 'center' }}
                            value={stockOverrides[product.vendorCode] !== undefined ? stockOverrides[product.vendorCode] : (product.stock ?? 10)}
                            onChange={(e) => updateStock(product.vendorCode, e.target.value === '' ? '' : parseInt(e.target.value))}
                            onBlur={(e) => { if (e.target.value === '') updateStock(product.vendorCode, 10); }}
                          />
                        </td>
                        <td>
                          <div className="flex-center">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                              <div style={{ flex: 1, width: '100%' }}>
                                {(() => {
                                  const currentName = names[product.vendorCode] !== undefined ? names[product.vendorCode] : product.name;
                                  const charCount = currentName.length;
                                  const isOverLimit = charCount > 50;
                                  return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', width: '100%' }}>
                                      <input 
                                        type="text" 
                                        className="input-field" 
                                        value={currentName} 
                                        onChange={(e) => updateName(product.vendorCode, product.name, e.target.value)}
                                        style={{ borderColor: isOverLimit ? '#f87171' : 'var(--border-color)', width: '100%', padding: '0.4rem' }}
                                        title={product.name}
                                      />
                                      <div style={{ fontSize: '0.75rem', color: isOverLimit ? '#f87171' : 'var(--text-muted)', textAlign: 'right' }}>
                                        {charCount}/50 {isOverLimit && '⚠️'}
                                      </div>
                                    </div>
                                  );
                                })()}
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                  {product.vendorCode} | {product.oldPrice ? <><span style={{ textDecoration: 'line-through', color: '#f87171' }}>{product.oldPrice}</span> <span style={{ color: '#10b981', fontWeight: 600 }}>{product.price} ₴</span></> : `${product.price} ₴`} | {product.category}
                                  {isHoroshopOutOfStock(product) && (
                                    <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', padding: '0.1rem 0.45rem', borderRadius: '4px', background: '#fee2e2', color: '#b91c1c', fontWeight: 600 }}>
                                      ⚠️ Немає в наявності на Хорошопі
                                    </span>
                                  )}
                                  {isMissingInExcel(product) && (
                                    <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', padding: '0.1rem 0.45rem', borderRadius: '4px', background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>
                                      ⚠️ Немає артикулу в Excel
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', background: daysColor + '20', border: '1px solid ' + daysColor + '60', color: daysColor, fontWeight: 700, fontSize: '0.9rem' }}>{daysToDispatch}</span>
                        </td>
                        <td>
                          <input type="text" className="input-field" placeholder="Ввести..."
                            value={barcodes[product.vendorCode] || ''}
                            onChange={(e) => updateBarcode(product.vendorCode, e.target.value)}
                          />
                        </td>
                        <td>
                          {descriptions[product.vendorCode] ? (
                            <button className="btn" style={{ padding: '0.4rem 0.75rem', fontSize: '0.9rem', width: '100%', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.2)' }} onClick={() => setEditingDescriptionProduct(product)}>
                              Опис додано ✏️
                            </button>
                          ) : (
                            <button className="btn" style={{ padding: '0.4rem 0.75rem', fontSize: '0.9rem', width: '100%', background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--border-color)' }} onClick={() => setEditingDescriptionProduct(product)}>
                              ✏️ Редагувати опис
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Категорії - зховані по замовчуванню, приховуються коли пошук не активний */}
      {!searchQuery.trim() && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', padding: '0.75rem 1rem', background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '0.75rem' }}>
          <label className="toggle-switch">
            <input type="checkbox" checked={allSelected} onChange={handleToggleAll} />
            <span className="slider"></span>
          </label>
          <span style={{ fontWeight: 600 }}>
            {allSelected ? '🔴 Зняти всі галочки' : '🟢 Відмітити всі товари одним кліком'}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>({whitelist.length} з {catalog.length} відмічено)</span>
        </div>
      )}

      {!searchQuery.trim() && loading ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="loader" style={{ width: '40px', height: '40px', borderWidth: '3px' }}></span>
          <p>Завантаження даних з GitHub...</p>
        </div>
      ) : !searchQuery.trim() && catalog.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Немає товарів. Переконайтеся, що ви вказали правильне посилання на фід Хорошопу в налаштуваннях.
        </div>
      ) : !searchQuery.trim() && grouped.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          🎉 За вибраним фільтром проблемних товарів не знайдено!
        </div>
      ) : !searchQuery.trim() ? (
        grouped.map(([categoryName, products]) => {
          const { selected, total } = getCategoryStats(products);
          const isCollapsed = filterMode !== 'all' ? collapsedCategories[categoryName] === true : collapsedCategories[categoryName] !== false;

          return (
            <div key={categoryName} className="glass-panel" style={{ marginBottom: '1rem', padding: 0, overflow: 'hidden' }}>
              {/* Category header */}
              <div
                onClick={() => toggleCategory(categoryName)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.5rem',
                  cursor: 'pointer', borderBottom: isCollapsed ? 'none' : '1px solid var(--border-color)',
                  background: isCollapsed ? '#ffffff' : 'rgba(24, 24, 27, 0.04)',
                  transition: 'background 0.2s', userSelect: 'none'
                }}
              >
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '1rem' }}>{categoryName}</span>
                  <span className="badge" style={{ background: selected > 0 ? '#18181b' : '#f3f4f6', color: selected > 0 ? '#ffffff' : '#6b7280' }}>{selected}/{total}</span>
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>
                  {isCollapsed ? '▶' : '▼'}
                </span>
              </div>

              {/* Products table */}
              <div style={{ display: isCollapsed ? 'none' : 'block', overflowX: 'auto' }}>
                <table style={{ tableLayout: 'fixed', width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '60px' }}>Увімк</th>
                        <th style={{ width: '90px' }}>Наявність</th>
                        <th style={{ width: '80px' }}>Залишок</th>
                        <th>Товар</th>
                        <th style={{ width: '55px', textAlign: 'center' }}>Дні</th>
                        <th style={{ width: '145px' }}>Штрихкод</th>
                        <th style={{ width: '155px' }}>Кастомний опис</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map(product => {
                        const isSelected = whitelist.includes(product.vendorCode);
                        const isAvailable = availabilityOverrides[product.vendorCode] !== false;
                        return (
                          <tr key={product.vendorCode} style={{ opacity: isSelected ? 1 : 0.5 }}>
                            <td>
                              <label className="toggle-switch">
                                <input type="checkbox" checked={isSelected} onChange={() => toggleWhitelist(product.vendorCode)} />
                                <span className="slider"></span>
                              </label>
                            </td>
                            <td>
                          <label className="toggle-switch" style={{ opacity: isSelected ? 1 : 0.4 }}>
                            <input type="checkbox" checked={isAvailable} disabled={!isSelected} onChange={() => toggleAvailability(product.vendorCode)} />
                            <span className="slider" style={{ background: isAvailable ? '#10b981' : '#f87171' }}></span>
                          </label>
                        </td>
                            <td>
                              <input type="number" min="0" className="input-field" 
                                style={{ width: '100%', padding: '0.4rem', textAlign: 'center' }}
                                value={stockOverrides[product.vendorCode] !== undefined ? stockOverrides[product.vendorCode] : (product.stock ?? 10)}
                                onChange={(e) => updateStock(product.vendorCode, e.target.value === '' ? '' : parseInt(e.target.value))}
                                onBlur={(e) => { if (e.target.value === '') updateStock(product.vendorCode, 10); }}
                              />
                            </td>
                            <td>
                              <div className="flex-center">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                                  <div style={{ flex: 1, width: '100%' }}>
                                    {(() => {
                                      const currentName = names[product.vendorCode] !== undefined ? names[product.vendorCode] : product.name;
                                      const charCount = currentName.length;
                                      const isOverLimit = charCount > 50;
                                      return (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', width: '100%' }}>
                                          <input 
                                            type="text" 
                                            className="input-field" 
                                            value={currentName} 
                                            onChange={(e) => updateName(product.vendorCode, product.name, e.target.value)}
                                            style={{ borderColor: isOverLimit ? '#f87171' : 'var(--border-color)', width: '100%', padding: '0.4rem' }}
                                            title={product.name}
                                          />
                                          <div style={{ fontSize: '0.75rem', color: isOverLimit ? '#f87171' : 'var(--text-muted)', textAlign: 'right' }}>
                                            {charCount}/50 {isOverLimit && '⚠️'}
                                          </div>
                                        </div>
                                      );
                                    })()}
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                      {product.vendorCode} | {product.oldPrice ? <><span style={{ textDecoration: 'line-through', color: '#f87171' }}>{product.oldPrice}</span> <span style={{ color: '#10b981', fontWeight: 600 }}>{product.price} ₴</span></> : `${product.price} ₴`}
                                      {isHoroshopOutOfStock(product) && (
                                        <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', padding: '0.1rem 0.45rem', borderRadius: '4px', background: '#fee2e2', color: '#b91c1c', fontWeight: 600 }}>
                                          ⚠️ Немає в наявності на Хорошопі
                                        </span>
                                      )}
                                      {isMissingInExcel(product) && (
                                        <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', padding: '0.1rem 0.45rem', borderRadius: '4px', background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>
                                          ⚠️ Немає артикулу в Excel
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', background: daysColor + '20', border: '1px solid ' + daysColor + '60', color: daysColor, fontWeight: 700, fontSize: '0.9rem' }}>{daysToDispatch}</span>
                            </td>
                            <td>
                              <input type="text" className="input-field" placeholder="Ввести..."
                                value={barcodes[product.vendorCode] || ''}
                                onChange={(e) => updateBarcode(product.vendorCode, e.target.value)}
                              />
                            </td>
                            <td>
                              {descriptions[product.vendorCode] ? (
                                <button className="btn" style={{ padding: '0.4rem 0.75rem', fontSize: '0.9rem', width: '100%', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.2)' }} onClick={() => setEditingDescriptionProduct(product)}>
                                  Опис додано ✏️
                                </button>
                              ) : (
                                <button className="btn" style={{ padding: '0.4rem 0.75rem', fontSize: '0.9rem', width: '100%', background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--border-color)' }} onClick={() => setEditingDescriptionProduct(product)}>
                                  ✏️ Редагувати опис
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
            </div>
          );
        })
      ) : null}

      </div>

      {activeTab === 'prom' && (
        <div>
          {/* Controls bar */}
          <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
              <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1.1rem', pointerEvents: 'none' }}>🔍</span>
              <input
                type="text"
                className="input-field"
                placeholder="Пошук товарів Prom за назвою чи артикулом..."
                value={promSearchQuery}
                onChange={e => setPromSearchQuery(e.target.value)}
                style={{ paddingLeft: '2.5rem', fontSize: '1rem' }}
              />
              {promSearchQuery && (
                <button
                  onClick={() => setPromSearchQuery('')}
                  style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-muted)' }}
                >✕</button>
              )}
            </div>
                        <select
              className="input-field"
              style={{ width: '280px', fontSize: '0.95rem', cursor: 'pointer' }}
              value={promFilterMode}
              onChange={e => setPromFilterMode(e.target.value)}
            >
              <option value="all">👁️ Усі товари ({catalog.length})</option>
              <option value="no_match">⚠️ Немає збігу артикулу ({promStats.noMatch})</option>
              <option value="out_of_stock_horoshop">⚠️ Немає в наявності на Хорошопі ({promStats.outOfStockHoroshop})</option>
              <option value="enabled">🟣 Увімкнені для Prom ({promStats.enabled})</option>
              <option value="in_stock">🟢 В наявності ({promStats.inStock})</option>
              <option value="out_of_stock">🔴 Немає в наявності ({promStats.outOfStock})</option>
              <option value="disabled">⚪ Вимкнені (Немає в наявн.) ({promStats.disabled})</option>
            </select>

            

            <select
              className="input-field"
              style={{ width: '220px', fontSize: '0.95rem', cursor: 'pointer' }}
              value={promCategoryFilter}
              onChange={e => setPromCategoryFilter(e.target.value)}
            >
              <option value="all">📁 Усі категорії</option>
              {grouped.map(([catName, prods]) => (
                <option key={catName} value={catName}>{catName} ({prods.length})</option>
              ))}
            </select>
          </div>

          {/* Quick bulk actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Знайдено: <strong style={{ color: 'var(--text-main)' }}>{filteredPromCatalog.length}</strong> товарів {!promSearchQuery.trim() && `у ${promGrouped.length} категоріях`}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                className="btn"
                style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', border: '1px solid rgba(139, 92, 246, 0.3)', padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
                onClick={() => handleBulkPromToggle(true)}
              >
                🟣 Увімкнути всі для Prom
              </button>
              <button
                className="btn"
                style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
                onClick={() => handleBulkPromToggle(false)}
              >
                ⚪ Вимкнути всі з Prom
              </button>
              {!promSearchQuery.trim() && (
                <>
                  <button
                    className="btn"
                    style={{ background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
                    onClick={expandAllProm}
                    title="Розгорнути всі категорії"
                  >
                    ▼ Розгорнути всі
                  </button>
                  <button
                    className="btn"
                    style={{ background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
                    onClick={collapseAllProm}
                    title="Згорнути всі категорії"
                  >
                    ▶ Згорнути всі
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Prom Products: Flat Table on Search, Accordion on Categories */}
          {promSearchQuery.trim() ? (
            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.95rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <th style={{ padding: '1rem', width: '130px', textAlign: 'center' }}>Продавати на Prom</th>
                    <th style={{ padding: '1rem', width: '70px', textAlign: 'center' }}>Фото</th>
                    <th style={{ padding: '1rem', width: '160px' }}>Артикул</th>
                    <th style={{ padding: '1rem' }}>Назва товару</th>
                    <th style={{ padding: '1rem', width: '120px' }}>Ціна</th>
                    <th style={{ padding: '1rem', width: '140px', textAlign: 'center' }}>Склад (Excel)</th>
                    <th style={{ padding: '1rem', width: '230px' }}>Статус на Prom.ua</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPromCatalog.slice(0, 200).map(product => renderPromProductRow(product))}
                </tbody>
              </table>
              {filteredPromCatalog.length > 200 && (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', background: '#f8fafc', borderTop: '1px solid var(--border-color)' }}>
                  Показано перші 200 товарів із {filteredPromCatalog.length}.
                </div>
              )}
              {filteredPromCatalog.length === 0 && (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
                  Товарів не знайдено за вказаними фільтрами
                </div>
              )}
            </div>
          ) : (
            <div>
              {promGrouped.length === 0 ? (
                <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
                  Товарів не знайдено за вказаними фільтрами
                </div>
              ) : (
                promGrouped.map(([categoryName, products]) => {
                  const { enabled, total } = getPromCategoryStats(products);
                  const isCollapsed = collapsedPromCategories[categoryName] !== false;

                  return (
                    <div key={categoryName} className="glass-panel" style={{ marginBottom: '0.75rem', padding: 0, overflow: 'hidden' }}>
                      {/* Category header */}
                      <div
                        onClick={() => togglePromCategory(categoryName)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.9rem 1.25rem',
                          cursor: 'pointer', borderBottom: isCollapsed ? 'none' : '1px solid var(--border-color)',
                          background: isCollapsed ? '#ffffff' : 'rgba(139, 92, 246, 0.05)',
                          transition: 'background 0.2s', userSelect: 'none'
                        }}
                      >
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{categoryName}</span>
                          <span className="badge" style={{ background: enabled > 0 ? '#dcfce7' : '#f3f4f6', color: enabled > 0 ? '#15803d' : '#6b7280' }}>
                            {enabled}/{total}
                          </span>
                        </div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '1.1rem', padding: '0 0.5rem' }}>
                          {isCollapsed ? '▶' : '▼'}
                        </span>
                      </div>

                      {/* Category table */}
                      {!isCollapsed && (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.95rem' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                <th style={{ padding: '0.85rem 1rem', width: '130px', textAlign: 'center' }}>Продавати на Prom</th>
                                <th style={{ padding: '0.85rem 1rem', width: '70px', textAlign: 'center' }}>Фото</th>
                                <th style={{ padding: '0.85rem 1rem', width: '160px' }}>Артикул</th>
                                <th style={{ padding: '0.85rem 1rem' }}>Назва товару</th>
                                <th style={{ padding: '0.85rem 1rem', width: '120px' }}>Ціна</th>
                                <th style={{ padding: '0.85rem 1rem', width: '140px', textAlign: 'center' }}>Склад (Excel)</th>
                                <th style={{ padding: '0.85rem 1rem', width: '230px' }}>Статус на Prom.ua</th>
                              </tr>
                            </thead>
                            <tbody>
                              {products.map(product => renderPromProductRow(product))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'horoshop' && (
        <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
          {/* Info Banner */}
          <div style={{ padding: '0.9rem 1.15rem', borderRadius: '8px', background: 'rgba(67, 96, 160, 0.08)', border: '1px solid rgba(67, 96, 160, 0.25)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: '1.5', maxWidth: '850px' }}>
              💡 <strong>Керування Наявністю та Оплатою частинами для Хорошопу:</strong>
              <div style={{ marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <div>• <strong>Наявність:</strong> <code>🔴 Немає</code> (примусово зняти з продажу) | <code>⚡ Авто</code> (за складом: &gt;0 є, 0 немає) | <code>🟢 Є</code> (примусово в наявності).</div>
                <div>• <strong>Оплата частинами:</strong> <code>🔴 Заборона</code> (ОЧ вимкнено) | <code>⚡ Авто</code> (ОЧ активна тільки якщо є на складі) | <code>🟣 Примусово</code> (ОЧ увімкнено навіть при 0 на складі).</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>🔒 <em>При оновленні передаються тільки статуси наявності та ОЧ — жодні інші дані товару не перезаписуються, і нічого не видаляється.</em></div>
              </div>
            </div>
            <button
              className="btn"
              style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem', background: 'rgba(67, 96, 160, 0.12)', color: '#4360a0', border: '1px solid rgba(67, 96, 160, 0.3)' }}
              onClick={() => copyToClipboard(FEED_URLS.horoshop)}
              title="Копіювати URL XML-файлу для імпорту ОЧ в Хорошоп"
            >
              📋 Скопіювати XML фід ОЧ
            </button>
          </div>

          {/* Search, Filter dropdown, Category filter */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
              <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1.1rem', pointerEvents: 'none' }}>🔍</span>
              <input
                type="text"
                className="input-field"
                placeholder="Пошук у Хорошоп за назвою або артикулом..."
                value={horoshopSearchQuery}
                onChange={e => setHoroshopSearchQuery(e.target.value)}
                style={{ paddingLeft: '2.5rem', fontSize: '0.95rem', width: '100%' }}
              />
              {horoshopSearchQuery && (
                <button
                  onClick={() => setHoroshopSearchQuery('')}
                  style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-muted)' }}
                >✕</button>
              )}
            </div>

            <select
              className="input-field"
              style={{ width: '290px', fontSize: '0.95rem', cursor: 'pointer' }}
              value={horoshopFilterMode}
              onChange={e => setHoroshopFilterMode(e.target.value)}
            >
              <option value="all">👁️ Усі товари ({catalog.length})</option>
              <option value="presence_in_stock">🟢 В наявності на Хорошоп ({horoshopStats.inStock})</option>
              <option value="presence_out_of_stock">⚪ Немає в наявності ({horoshopStats.outOfStock})</option>
              <option value="presence_off">🔴 Тільки примусово "Немає" ({horoshopStats.forcedOutOfStock})</option>
              <option value="presence_on">🟢 Тільки примусово "Є" ({horoshopStats.forcedInStock})</option>
              <option value="installments_active">💳 Оплата частинами активна ({horoshopStats.active})</option>
              <option value="installments_forced">🟣 Примусово ОЧ ({horoshopStats.forced})</option>
              <option value="installments_disabled">🚫 ОЧ заборонено вручну ({horoshopStats.disabled})</option>
            </select>

            <select
              className="input-field"
              style={{ width: '220px', fontSize: '0.95rem', cursor: 'pointer' }}
              value={horoshopCategoryFilter}
              onChange={e => setHoroshopCategoryFilter(e.target.value)}
            >
              <option value="all">📁 Всі категорії ({horoshopCategories.length})</option>
              {horoshopCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Bulk actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Знайдено: <strong>{filteredHoroshopCatalog.length}</strong> товарів {!horoshopSearchQuery.trim() && `у ${horoshopGrouped.length} категоріях`}
            </div>
            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
              <button
                className="btn"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', background: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1' }}
                onClick={() => handleBulkPresenceMode('auto')}
                title="Встановити авто-наявність за складом для всіх відфільтрованих товарів"
              >
                ⚡ Наявність: Авто
              </button>
              <button
                className="btn"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}
                onClick={() => handleBulkPresenceMode('off')}
                title="Примусово встановити 'Немає в наявності' для всіх відфільтрованих товарів"
              >
                🔴 Наявність: Немає
              </button>
              <button
                className="btn"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}
                onClick={() => handleBulkPresenceMode('on')}
                title="Примусово встановити 'В наявності' для всіх відфільтрованих товарів"
              >
                🟢 Наявність: Є
              </button>
              <span style={{ borderLeft: '1px solid var(--border-color)', margin: '0 0.15rem' }}></span>
              <button
                className="btn"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', background: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1' }}
                onClick={() => handleBulkInstallmentsMode('auto')}
                title="Встановити авто-ОЧ для всіх відфільтрованих товарів"
              >
                ⚡ ОЧ: Авто
              </button>
              <button
                className="btn"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}
                onClick={() => handleBulkInstallmentsMode('off')}
                title="Заборонити ОЧ для всіх відфільтрованих товарів"
              >
                🔴 Заборонити ОЧ
              </button>
              <button
                className="btn"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe' }}
                onClick={() => handleBulkInstallmentsMode('on')}
                title="Примусово увімкнути ОЧ для всіх відфільтрованих товарів"
              >
                🟣 Примусово ОЧ
              </button>
              {!horoshopSearchQuery.trim() && (
                <>
                  <span style={{ borderLeft: '1px solid var(--border-color)', margin: '0 0.15rem' }}></span>
                  <button
                    className="btn"
                    style={{ background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                    onClick={expandAllHoroshop}
                    title="Розгорнути всі категорії"
                  >
                    ▼ Розгорнути всі
                  </button>
                  <button
                    className="btn"
                    style={{ background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                    onClick={collapseAllHoroshop}
                    title="Згорнути всі категорії"
                  >
                    ▶ Згорнути всі
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Horoshop Products: Flat Table on Search, Accordion on Categories */}
          {horoshopSearchQuery.trim() ? (
            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.95rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <th style={{ padding: '0.85rem 0.5rem', width: '155px', textAlign: 'center' }}>Наявність на Хорошоп</th>
                    <th style={{ padding: '0.85rem 0.5rem', width: '165px', textAlign: 'center' }}>Оплата частинами (ОЧ)</th>
                    <th style={{ padding: '0.85rem 0.5rem', width: '60px', textAlign: 'center' }}>Фото</th>
                    <th style={{ padding: '0.85rem 0.5rem', width: '135px' }}>Артикул</th>
                    <th style={{ padding: '0.85rem 0.5rem' }}>Назва товару</th>
                    <th style={{ padding: '0.85rem 0.5rem', width: '95px' }}>Ціна</th>
                    <th style={{ padding: '0.85rem 0.5rem', width: '105px', textAlign: 'center' }}>Склад (Excel)</th>
                    <th style={{ padding: '0.85rem 0.5rem', width: '250px' }}>Підсумковий статус</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHoroshopCatalog.slice(0, 200).map(product => renderHoroshopProductRow(product))}
                </tbody>
              </table>
              {filteredHoroshopCatalog.length > 200 && (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', background: '#f8fafc', borderTop: '1px solid var(--border-color)' }}>
                  Показано перші 200 товарів із {filteredHoroshopCatalog.length}. Використовуйте фільтр категорій для точного вибору.
                </div>
              )}
              {filteredHoroshopCatalog.length === 0 && (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
                  Товарів не знайдено за вказаними фільтрами
                </div>
              )}
            </div>
          ) : (
            <div>
              {horoshopGrouped.length === 0 ? (
                <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
                  Товарів не знайдено за вказаними фільтрами
                </div>
              ) : (
                horoshopGrouped.map(([categoryName, products]) => {
                  const { active, total } = getHoroshopCategoryStats(products);
                  const isCollapsed = collapsedHoroshopCategories[categoryName] !== false;

                  return (
                    <div key={categoryName} className="glass-panel" style={{ marginBottom: '0.75rem', padding: 0, overflow: 'hidden' }}>
                      {/* Category header */}
                      <div
                        onClick={() => toggleHoroshopCategory(categoryName)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.9rem 1.25rem',
                          cursor: 'pointer', borderBottom: isCollapsed ? 'none' : '1px solid var(--border-color)',
                          background: isCollapsed ? '#ffffff' : 'rgba(67, 96, 160, 0.06)',
                          transition: 'background 0.2s', userSelect: 'none'
                        }}
                      >
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{categoryName}</span>
                          <span className="badge" style={{ background: inStock > 0 ? '#dcfce7' : '#f3f4f6', color: inStock > 0 ? '#166534' : '#6b7280' }}>
                            В наявності: {inStock}/{total}
                          </span>
                          <span className="badge" style={{ background: active > 0 ? '#f3e8ff' : '#f3f4f6', color: active > 0 ? '#6b21a8' : '#6b7280' }}>
                            ОЧ: {active}/{total}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.35rem', marginRight: '0.75rem' }} onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            className="btn"
                            style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }}
                            onClick={() => handleBulkPresenceMode('off', products)}
                            title="Поставити 'Немає в наявності' для всіх товарів цієї категорії"
                          >
                            🔴 Немає всі
                          </button>
                          <button
                            type="button"
                            className="btn"
                            style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}
                            onClick={() => handleBulkPresenceMode('auto', products)}
                            title="Поставити 'Авто' за складом для всіх товарів цієї категорії"
                          >
                            ⚡ Авто всі
                          </button>
                        </div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '1.1rem', padding: '0 0.5rem' }}>
                          {isCollapsed ? '▶' : '▼'}
                        </span>
                      </div>

                      {/* Category table */}
                      {!isCollapsed && (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.95rem' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                <th style={{ padding: '0.85rem 0.5rem', width: '155px', textAlign: 'center' }}>Наявність на Хорошоп</th>
                                <th style={{ padding: '0.85rem 0.5rem', width: '165px', textAlign: 'center' }}>Оплата частинами (ОЧ)</th>
                                <th style={{ padding: '0.85rem 0.5rem', width: '60px', textAlign: 'center' }}>Фото</th>
                                <th style={{ padding: '0.85rem 0.5rem', width: '135px' }}>Артикул</th>
                                <th style={{ padding: '0.85rem 0.5rem' }}>Назва товару</th>
                                <th style={{ padding: '0.85rem 0.5rem', width: '95px' }}>Ціна</th>
                                <th style={{ padding: '0.85rem 0.5rem', width: '105px', textAlign: 'center' }}>Склад (Excel)</th>
                                <th style={{ padding: '0.85rem 0.5rem', width: '250px' }}>Підсумковий статус</th>
                              </tr>
                            </thead>
                            <tbody>
                              {products.map(product => renderHoroshopProductRow(product))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* Logs modal */}
      {showLogs && (
        <div className="modal-overlay" onClick={() => setShowLogs(false)}>
          <div className="glass-panel modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h2>📝 Історія оновлень</h2>
            <p style={{ color: 'var(--text-muted)' }}>Останні запуски відправки фідів на GitHub.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}>
              {workflowRuns.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Немає даних...</div>}
              {workflowRuns.map(run => {
                const isSuccess = run.conclusion === 'success';
                const isFailure = run.conclusion === 'failure';
                const isRunning = run.status === 'in_progress' || run.status === 'queued';
                
                let icon = '⚪';
                if (isSuccess) icon = '✅';
                if (isFailure) icon = '❌';
                if (isRunning) icon = '⏳';

                const date = new Date(run.created_at).toLocaleString('uk-UA');
                
                return (
                  <div key={run.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'var(--surface-color)', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '1.2rem' }}>{icon}</span>
                      <div>
                        <div style={{ fontWeight: 600 }}>Оновлення фідів</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{date}</div>
                      </div>
                    </div>
                    <div>
                      <a href={run.html_url} target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '0.875rem' }}>Деталі ↗</a>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button className="btn success" onClick={() => setShowLogs(false)}>Закрити</button>
            </div>
          </div>
        </div>
      )}

      {/* Product Preview modal removed */}

            {/* Stock Changes Notification & Log Modal */}
      {showStockLog && (
        <div className="modal-overlay" onClick={() => setShowStockLog(false)} style={{ zIndex: 1100 }}>
          <div className="glass-panel modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '920px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '1.75rem' }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span>🔔</span> Журнал змін залишків у таблиці Excel
                </h2>
                <p style={{ margin: '0.35rem 0 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  Фіксація оновлень кількості на складі з Google Таблиць. Швидкий перехід до товару на Хорошопі для оперативного редагування наявності.
                </p>
              </div>
              <button
                onClick={() => setShowStockLog(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.35rem', color: 'var(--text-muted)', padding: '0.2rem' }}
                title="Закрити"
              >
                ✕
              </button>
            </div>

            {/* Quick KPI Stat Chips */}
            {(() => {
              const becameZeroCount = stockChanges.filter(c => c.type === 'became_zero' || c.newQty === 0).length;
              const becameAvailCount = stockChanges.filter(c => c.type === 'became_available' || (c.oldQty === 0 && c.newQty > 0)).length;
              const otherCount = stockChanges.filter(c => c.type === 'changed' || (c.oldQty > 0 && c.newQty > 0)).length;
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div
                    onClick={() => setStockLogFilter(stockLogFilter === 'became_zero' ? 'all' : 'became_zero')}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '10px',
                      background: stockLogFilter === 'became_zero' ? '#fee2e2' : '#fef2f2',
                      border: stockLogFilter === 'became_zero' ? '2px solid #ef4444' : '1px solid #fecdd3',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                    title="Фільтрувати: товари, що закінчилися"
                  >
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase' }}>🔴 Закінчилися (стало 0)</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#dc2626' }}>{becameZeroCount}</div>
                  </div>

                  <div
                    onClick={() => setStockLogFilter(stockLogFilter === 'became_available' ? 'all' : 'became_available')}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '10px',
                      background: stockLogFilter === 'became_available' ? '#dcfce7' : '#f0fdf4',
                      border: stockLogFilter === 'became_available' ? '2px solid #10b981' : '1px solid #bbf7d0',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                    title="Фільтрувати: товари, що з'явилися"
                  >
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>🟢 З'явилися на складі</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#059669' }}>{becameAvailCount}</div>
                  </div>

                  <div
                    onClick={() => setStockLogFilter(stockLogFilter === 'changed' ? 'all' : 'changed')}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '10px',
                      background: stockLogFilter === 'changed' ? '#e2e8f0' : '#f8fafc',
                      border: stockLogFilter === 'changed' ? '2px solid #64748b' : '1px solid #e2e8f0',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                    title="Фільтрувати: інші зміни залишків"
                  >
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>📦 Інші зміни кількості</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#334155' }}>{otherCount}</div>
                  </div>

                  <div
                    onClick={() => setStockLogFilter('all')}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '10px',
                      background: stockLogFilter === 'all' ? '#e0f2fe' : '#f0f9ff',
                      border: stockLogFilter === 'all' ? '2px solid #0284c7' : '1px solid #bae6fd',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                    title="Показати всі зафіксовані зміни"
                  >
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' }}>⏱️ Всього в журналі</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0284c7' }}>{stockChanges.length}</div>
                  </div>
                </div>
              );
            })()}

            {/* Search and Filter Controls */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
                <span style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '0.9rem' }}>🔍</span>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Пошук за артикулом чи назвою товару..."
                  value={stockLogSearch}
                  onChange={e => setStockLogSearch(e.target.value)}
                  style={{ paddingLeft: '2.3rem', width: '100%', fontSize: '0.875rem' }}
                />
                {stockLogSearch && (
                  <button
                    onClick={() => setStockLogSearch('')}
                    style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                  >✕</button>
                )}
              </div>

              <select
                className="input-field"
                value={stockLogFilter}
                onChange={e => setStockLogFilter(e.target.value)}
                style={{ width: 'auto', minWidth: '210px', fontSize: '0.875rem' }}
              >
                <option value="all">👁️ Всі зміни ({stockChanges.length})</option>
                <option value="became_zero">🔴 Закінчилися (стало 0)</option>
                <option value="became_available">🟢 З'явилися на складі</option>
                <option value="changed">📦 Інші зміни залишків</option>
              </select>

              {stockChanges.length > 0 && (
                <button
                  className="btn"
                  style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', fontSize: '0.8rem', padding: '0.5rem 0.85rem' }}
                  onClick={handleClearStockLog}
                  title="Очистити історію змін залишків"
                >
                  🗑️ Очистити історію
                </button>
              )}
            </div>

            {/* List of changes */}
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.5rem' }}>
              {filteredStockChanges.length === 0 ? (
                <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📭</div>
                  <div style={{ fontWeight: 600, fontSize: '1rem', color: '#475569' }}>Жодних змін залишків не знайдено</div>
                  <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                    {stockChanges.length === 0 
                      ? 'Зміни фіксуються автоматично під час кожної синхронізації з Google Sheets при зміні залишків у таблиці.'
                      : 'Спробуйте скинути фільтри або пошуковий запит.'}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {filteredStockChanges.map(item => {
                    const isBecameZero = item.type === 'became_zero' || item.newQty === 0;
                    const isBecameAvail = item.type === 'became_available' || (item.oldQty === 0 && item.newQty > 0);
                    const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Нещодавно';
                    const currentStock = stockOverrides[item.vendorCode] !== undefined ? stockOverrides[item.vendorCode] : item.newQty;

                    return (
                      <div
                        key={item.id || item.vendorCode + item.timestamp}
                        style={{
                          background: isBecameZero ? 'rgba(254, 242, 242, 0.55)' : isBecameAvail ? 'rgba(240, 253, 244, 0.55)' : '#ffffff',
                          border: isBecameZero ? '1px solid #fecdd3' : isBecameAvail ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                          borderRadius: '8px',
                          padding: '0.85rem 1rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '1rem',
                          flexWrap: 'wrap',
                          transition: 'all 0.15s'
                        }}
                      >
                        {/* Item main info */}
                        <div style={{ flex: 1, minWidth: '260px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.9rem', color: '#0f172a', background: '#f1f5f9', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                              {item.vendorCode}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              ⏱️ {dateStr}
                            </span>
                            {item.category && (
                              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                • {item.category}
                              </span>
                            )}
                          </div>
                          <div style={{ fontWeight: 600, fontSize: '0.925rem', color: '#0f172a', lineHeight: 1.3 }}>
                            {item.name || item.vendorCode}
                          </div>
                        </div>

                        {/* Stock change badge */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: '220px' }}>
                          {isBecameZero ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#fee2e2', color: '#991b1b', border: '1px solid #fecdd3', borderRadius: '6px', padding: '0.3rem 0.65rem', fontWeight: 700, fontSize: '0.85rem' }}>
                              <span>🔴</span>
                              <span>Було: <strong>{item.oldQty} шт</strong> ➔ Стало: <strong>0 шт</strong></span>
                            </div>
                          ) : isBecameAvail ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#dcfce7', color: '#166534', border: '1px solid #a7f3d0', borderRadius: '6px', padding: '0.3rem 0.65rem', fontWeight: 700, fontSize: '0.85rem' }}>
                              <span>🟢</span>
                              <span>Було: <strong>0 шт</strong> ➔ Стало: <strong>{item.newQty} шт</strong> (+{item.newQty})</span>
                            </div>
                          ) : (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.3rem 0.65rem', fontWeight: 700, fontSize: '0.85rem' }}>
                              <span>📦</span>
                              <span>Було: <strong>{item.oldQty} шт</strong> ➔ Стало: <strong>{item.newQty} шт</strong> ({item.diff > 0 ? `+${item.diff}` : item.diff})</span>
                            </div>
                          )}
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                            {isBecameZero && '⚠️ Рекомендовано вимкнути на Хорошопі'}
                            {isBecameAvail && '✨ Рекомендовано увімкнути на Хорошопі'}
                            {!isBecameZero && !isBecameAvail && `Поточний залишок: ${currentStock} шт`}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <button
                            className="btn"
                            style={{
                              background: '#4360a0',
                              color: '#ffffff',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              padding: '0.45rem 0.85rem',
                              borderRadius: '6px',
                              boxShadow: '0 1px 2px rgba(67, 96, 160, 0.2)'
                            }}
                            onClick={() => navigateToHoroshop(item.vendorCode)}
                            title="Відкрити товар у вкладці Хорошоп"
                          >
                            📦 На Хорошоп
                          </button>
                          <button
                            className="btn"
                            style={{
                              background: 'rgba(139, 92, 246, 0.1)',
                              color: '#7c3aed',
                              border: '1px solid rgba(139, 92, 246, 0.25)',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              padding: '0.45rem 0.75rem',
                              borderRadius: '6px'
                            }}
                            onClick={() => navigateToProm(item.vendorCode)}
                            title="Відкрити товар у вкладці Prom.ua"
                          >
                            🟣 Prom
                          </button>
                          <button
                            className="btn"
                            style={{
                              background: '#f4f4f5',
                              color: '#18181b',
                              border: '1px solid #e4e4e7',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              padding: '0.45rem 0.75rem',
                              borderRadius: '6px'
                            }}
                            onClick={() => navigateToMono(item.vendorCode)}
                            title="Відкрити товар у вкладці Мономаркет"
                          >
                            🐾 Моно
                          </button>
                          <button
                            className="btn"
                            style={{
                              background: '#f8fafc',
                              color: '#64748b',
                              border: '1px solid #e2e8f0',
                              fontSize: '0.85rem',
                              padding: '0.45rem 0.55rem',
                              borderRadius: '6px'
                            }}
                            onClick={() => copyToClipboard(item.vendorCode)}
                            title="Скопіювати артикул"
                          >
                            📋
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Показано: <strong>{filteredStockChanges.length}</strong> з <strong>{stockChanges.length}</strong> записів змін
              </div>
              <button
                className="btn success"
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}
                onClick={() => setShowStockLog(false)}
              >
                Зрозуміло
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Description Editor Modal */}
      {editingDescriptionProduct && (
        <div className="modal-overlay" onClick={() => setEditingDescriptionProduct(null)}>
          <div className="glass-panel modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%' }}>
            <h2>✏️ Редагування опису</h2>
            <p style={{ color: 'var(--text-muted)' }}>
              Товар: <strong>{editingDescriptionProduct.name}</strong> ({editingDescriptionProduct.vendorCode})
            </p>

            <div style={{ marginTop: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Відео (посилання на mp4/webm)</label>
              <input 
                type="text" 
                placeholder="https://example.com/video.mp4"
                value={videos[editingDescriptionProduct.vendorCode] || ''} 
                onChange={e => updateVideo(editingDescriptionProduct.vendorCode, e.target.value)} 
                className="input-field" 
                style={{ width: '100%', padding: '0.75rem' }} 
              />
            </div>
            
            <div style={{ marginTop: '1rem', background: '#fff', color: '#000', borderRadius: '0.5rem', overflow: 'hidden' }}>
              <EditorProvider>
                <Editor 
                  value={descriptions[editingDescriptionProduct.vendorCode] !== undefined 
                    ? descriptions[editingDescriptionProduct.vendorCode] 
                    : (editingDescriptionProduct.description || '')} 
                  onChange={(e) => updateDescription(editingDescriptionProduct.vendorCode, e.target.value)} 
                  style={{ height: '350px' }}
                >
                  <Toolbar>
                    <BtnUndo />
                    <BtnRedo />
                    <Separator />
                    <BtnBold />
                    <BtnItalic />
                    <BtnUnderline />
                    <BtnStrikeThrough />
                    <Separator />
                    <BtnNumberedList />
                    <BtnBulletList />
                    <Separator />
                    <BtnLink />
                    <BtnClearFormatting />
                    <HtmlButton />
                    <Separator />
                    <BtnStyles />
                    <BtnH3 />
                  </Toolbar>
                </Editor>
              </EditorProvider>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', gap: '1rem' }}>
              {descriptions[editingDescriptionProduct.vendorCode] !== undefined && (
                <button 
                  className="btn" 
                  style={{ background: 'transparent', color: '#f87171', border: '1px solid #f87171' }} 
                  onClick={() => {
                    updateDescription(editingDescriptionProduct.vendorCode, undefined);
                    setEditingDescriptionProduct(null);
                  }}
                >
                  Видалити опис (Скинути до стандартного)
                </button>
              )}
              <button className="btn success" onClick={() => setEditingDescriptionProduct(null)}>Готово</button>
            </div>
          </div>
        </div>
      )}

      {/* Links modal */}
      {showLinks && (
        <div className="modal-overlay" onClick={() => setShowLinks(false)}>
          <div className="glass-panel modal" onClick={e => e.stopPropagation()}>
            <h2>🔗 Посилання для Мономаркету</h2>
            <p style={{ color: 'var(--text-muted)' }}>Вставте ці посилання у ваш кабінет Мономаркету. Оновлюються автоматично кожні 30 хвилин.</p>
            <div className="form-group">
              <label>📦 Товарний фід (XML) — назви, описи, фото, характеристики</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="text" className="input-field" value={FEED_URLS.xml} readOnly style={{ fontFamily: 'monospace', fontSize: '0.8rem' }} />
                <button className="btn" style={{ flexShrink: 0 }} onClick={() => copyToClipboard(FEED_URLS.xml)}>📋 Копіювати</button>
              </div>
            </div>
            <div className="form-group">
              <label>💰 Прайс-лист (JSON) — ціни, наявність, залишки</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="text" className="input-field" value={FEED_URLS.json} readOnly style={{ fontFamily: 'monospace', fontSize: '0.8rem' }} />
                <button className="btn" style={{ flexShrink: 0 }} onClick={() => copyToClipboard(FEED_URLS.json)}>📋 Копіювати</button>
              </div>
            </div>
            <div className="form-group">
              <label>🛍️ Файл для імпорту в Хорошоп (Покупка частинами)</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="text" className="input-field" value={FEED_URLS.horoshop} readOnly style={{ fontFamily: 'monospace', fontSize: '0.8rem' }} />
                <button className="btn" style={{ flexShrink: 0 }} onClick={() => copyToClipboard(FEED_URLS.horoshop)}>📋 Копіювати</button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button className="btn success" onClick={() => setShowLinks(false)}>Закрити</button>
            </div>
          </div>
        </div>
      )}

      {/* Settings modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="glass-panel modal" onClick={e => e.stopPropagation()}>
            <h2>⚙️ Налаштування</h2>
            <div className="form-group">
              <label>GitHub Personal Access Token</label>
              <input type="password" className="input-field" value={token} onChange={e => setToken(e.target.value)} placeholder="ghp_..." />
              <small style={{ color: 'var(--text-muted)' }}>Зберігається лише у вашому браузері.</small>
            </div>
            <div className="form-group">
              <label>🌐 URL XML-фіду Хорошопу</label>
              <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.25)', fontSize: '0.85rem', color: '#047857' }}>
                🔒 <strong>Захищено в GitHub Secrets (HOROSHOP_FEED_URL)</strong>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.25rem', lineHeight: '1.4' }}>
                  Посилання зберігається в зашифрованому вигляді на GitHub та використовується для генерації фіду.
                </div>
              </div>
            </div>
            <div className="form-group">
              <label>🟣 Prom.ua API Token</label>
              <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.25)', fontSize: '0.85rem', color: '#047857' }}>
                🔒 <strong>Захищено в GitHub Secrets (PROM_API_TOKEN)</strong>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.25rem', lineHeight: '1.4' }}>
                  Токен зберігається у зашифрованому вигляді на GitHub та використовується серверною синхронізацією.
                </div>
              </div>
            </div>
            <div className="form-group">
              <label>🤖 Telegram-бот сповіщень</label>
              <div style={{ padding: '0.75rem 0.85rem', background: 'rgba(37, 99, 235, 0.05)', borderRadius: '6px', border: '1px solid rgba(37, 99, 235, 0.2)', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                  <div>
                    🔒 <strong>Захищено в GitHub Secrets (TELEGRAM_BOT_TOKEN / CHAT_ID)</strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.25rem', lineHeight: '1.4' }}>
                      Бот надсилає оперативні звіти та сповіщення про помилки при синхронізації залишків.
                    </div>
                  </div>
                  <button
                    className="btn"
                    style={{ background: '#2563eb', color: '#fff', fontSize: '0.8rem', padding: '0.45rem 0.85rem', whiteSpace: 'nowrap', flexShrink: 0 }}
                    onClick={handleTestTelegram}
                    disabled={testingTelegram || !token}
                    title="Надіслати тестове повідомлення ботом у Telegram"
                  >
                    {testingTelegram ? <span className="loader" style={{ width: '14px', height: '14px' }}></span> : '📨 Тест сповіщення'}
                  </button>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
              <button className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={() => setShowSettings(false)}>Скасувати</button>
              <button className="btn success" onClick={handleSaveSettings} disabled={saving}>{saving ? 'Збереження...' : '✅ Зберегти'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
      </div>
    </div>
  );
}
