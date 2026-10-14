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

// Stored hash of: admin / totalenergoadmin
const STORED_LOGIN = 'admin';
const STORED_PASS_HASH = '316bceef33e561601a426930c141ce7dfc6b0f6df2a091d40135b0795cd1d4a9'; // totalenergoadmin

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
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Total Energo</h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>Monomarket Feed Admin</p>
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
  const [googleSheets, setGoogleSheets] = useState([]);

  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [activeTab, setActiveTab] = useState('catalog');
  
  const [promWhitelist, setPromWhitelist] = useState([]);
  const [promSkus, setPromSkus] = useState([]);
  const [promToken, setPromToken] = useState('d24092ed4ff1937f177358180846399f62841be0');
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
      const [catalogRes, whitelistRes, barcodesRes, descRes, configRes, availRes, stockRes, namesRes, videosRes, sheetsRes, alwaysAvailRes, promWhitelistRes, promConfigRes, promSkusRes, horoshopDisabledRes] = await Promise.all([
        api.getFile('feeds/catalog.json'),
        api.getFile('src/whitelist.json'),
        api.getFile('src/barcodes.json'),
        api.getFile('src/descriptions.json'),
        api.getFile('src/config.json'),
        api.getFile('src/availability.json'),
        api.getFile('src/stock.json'),
        api.getFile('src/names.json'),
        api.getFile('src/videos.json'),
        api.getFile('src/google-sheets.json'),
        api.getFile('src/always-available.json'),
        api.getFile('src/prom-whitelist.json'),
        api.getFile('src/prom-config.json'),
        api.getFile('src/prom-skus.json'),
        api.getFile('src/horoshop-disabled.json')
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
      if (barcodesRes.content) setBarcodes(JSON.parse(barcodesRes.content) || {});
      if (descRes.content) setDescriptions(JSON.parse(descRes.content) || {});
      if (availRes.content) setAvailabilityOverrides(JSON.parse(availRes.content) || {});
      if (stockRes.content) setStockOverrides(JSON.parse(stockRes.content) || {});
      if (namesRes.content) setNames(JSON.parse(namesRes.content) || {});
      if (videosRes && videosRes.content) setVideos(JSON.parse(videosRes.content) || {});
      if (sheetsRes && sheetsRes.content) {
        const parsed = JSON.parse(sheetsRes.content);
        setGoogleSheets(parsed.sheets || []);
      }
      if (configRes.content) setFeedUrl(JSON.parse(configRes.content).horoshopFeedUrl || '');
      
      if (promWhitelistRes && promWhitelistRes.content) {
        try { setPromWhitelist(JSON.parse(promWhitelistRes.content) || []); } catch (e) { }
      }
      if (promSkusRes && promSkusRes.content) {
        try { setPromSkus(JSON.parse(promSkusRes.content) || []); } catch (e) { }
      }
      if (promConfigRes && promConfigRes.content) {
        try {
          const cfg = JSON.parse(promConfigRes.content);
          if (cfg.token) setPromToken(cfg.token);
        } catch (e) { }
      }
      
      setShas({
        whitelist: whitelistRes.sha,
        barcodes: barcodesRes.sha,
        descriptions: descRes.sha,
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
    setSaving(true);
    try {
      const confRes = await api.saveFile('src/config.json', JSON.stringify({ horoshopFeedUrl: feedUrl }, null, 2), shas.config, 'Update config via Admin Panel');
      setShas({ ...shas, config: confRes.content.sha });
      if (promToken) {
        await api.saveFile('src/prom-config.json', JSON.stringify({ token: promToken }, null, 2), null, 'Update Prom token via Settings');
      }
      loadData();
    } catch (e) { console.error(e); }
    setSaving(false);
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
      if (promToken) {
        await api.saveFile('src/prom-config.json', JSON.stringify({ token: promToken }, null, 2), null, 'Update Prom config via UI');
      }
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

    return catalog.filter(p => {
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
      let stock = stockOverrides[code] !== undefined ? parseInt(stockOverrides[code], 10) : 0;
      if (alwaysAvailable.includes(code)) stock = Math.max(stock, 10);
      if (isNaN(stock) || stock < 0) stock = 0;

      if (promFilterMode === 'no_match') return !existsOnProm;
      if (promFilterMode === 'enabled') return isEnabled && existsOnProm;
      if (promFilterMode === 'disabled') return !isEnabled && existsOnProm;
      if (promFilterMode === 'in_stock') return isEnabled && existsOnProm && stock > 0;
      if (promFilterMode === 'out_of_stock') return isEnabled && existsOnProm && stock === 0;

      return true;
    });
  }, [catalog, promSearchQuery, promCategoryFilter, promFilterMode, promWhitelistSet, stockOverrides, alwaysAvailable, promSkusSet]);

  const promStats = useMemo(() => {
    let enabledCount = 0;
    let inStockCount = 0;
    let outOfStockCount = 0;
    let disabledCount = 0;
    let noMatchCount = 0;

    catalog.forEach(p => {
      const code = p.vendorCode ? String(p.vendorCode).trim() : '';
      const isEnabled = promWhitelistSet.has(code);
      const existsOnProm = promSkusSet.has(code);
      let stock = stockOverrides[code] !== undefined ? parseInt(stockOverrides[code], 10) : 0;
      if (alwaysAvailable.includes(code)) stock = Math.max(stock, 10);
      if (isNaN(stock) || stock < 0) stock = 0;

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
      noMatch: noMatchCount
    };
  }, [catalog, promWhitelistSet, stockOverrides, alwaysAvailable, promSkusSet]);

  const promGrouped = useMemo(() => {
    const map = {};
    for (const product of filteredPromCatalog) {
      const cat = product.category || 'Без категорії';
      if (!map[cat]) map[cat] = [];
      map[cat].push(product);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b, 'uk'));
  }, [filteredPromCatalog]);

  const getPromCategoryStats = (products) => {
    const enabled = products.filter(p => {
      const code = p.vendorCode ? String(p.vendorCode).trim() : '';
      return promWhitelistSet.has(code) && promSkusSet.has(code);
    }).length;
    return { enabled, total: products.length };
  };

  const toggleCategoryPromWhitelist = (products) => {
    const validCodes = products
      .map(p => p.vendorCode ? String(p.vendorCode).trim() : '')
      .filter(code => code && promSkusSet.has(code));
    if (validCodes.length === 0) return;

    const allOn = validCodes.every(c => promWhitelistSet.has(c));
    setPromWhitelist(prev => {
      const prevSet = new Set(prev);
      validCodes.forEach(c => {
        if (allOn) prevSet.delete(c);
        else prevSet.add(c);
      });
      return Array.from(prevSet);
    });
    showToast(allOn ? `⚪ Вимкнено категорію з Prom` : `🟣 Увімкнено категорію на Prom`);
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

  const toggleHoroshopAllowed = (vendorCode) => {
    const code = String(vendorCode).trim();
    setHoroshopDisabled(prev =>
      prev.includes(code)
        ? prev.filter(c => c !== code)
        : [...prev, code]
    );
  };

  const handleBulkHoroshopAllowed = (allow) => {
    const targetCodes = filteredHoroshopCatalog
      .map(p => p.vendorCode ? String(p.vendorCode).trim() : '')
      .filter(Boolean);
    setHoroshopDisabled(prev => {
      const prevSet = new Set(prev);
      targetCodes.forEach(code => {
        if (allow) prevSet.delete(code);
        else prevSet.add(code);
      });
      return Array.from(prevSet);
    });
    showToast(allow ? `🟢 Дозволено ОЧ для ${targetCodes.length} товарів` : `🔴 Заборонено ОЧ для ${targetCodes.length} товарів`);
  };

  const handleBulkHoroshopToggle = (enable) => {
    const targetCodes = filteredHoroshopCatalog
      .map(p => p.vendorCode ? String(p.vendorCode).trim() : '')
      .filter(Boolean);
    setAlwaysAvailable(prev => {
      const prevSet = new Set(prev);
      targetCodes.forEach(code => {
        if (enable) prevSet.add(code);
        else prevSet.delete(code);
      });
      return Array.from(prevSet);
    });
    showToast(enable ? `💜 Увімкнено примусово ОЧ для ${targetCodes.length} товарів` : `⚪ Знято примусову ОЧ для ${targetCodes.length} товарів`);
  };

  const handleSaveHoroshop = async () => {
    setSavingHoroshop(true);
    try {
      await api.saveFile('src/always-available.json', JSON.stringify(alwaysAvailable, null, 2), null, 'Update Horoshop always available via UI');
      await api.saveFile('src/horoshop-disabled.json', JSON.stringify(horoshopDisabled, null, 2), null, 'Update Horoshop disabled products via UI');
      showToast('💾 Збережено! Запускаємо передачу в Хорошоп...');
      try {
        await api.triggerWorkflow();
        showToast('✅ Збережено та передається в Хорошоп! (~1-2 хв)');
      } catch (_) {
        showToast('✅ Збережено! (Оновиться за графіком або натисніть "Оновити Хорошоп")');
      }
    } catch (e) {
      console.error('Horoshop save error:', e);
      showToast('❌ Помилка: ' + (e?.message || 'невідома'));
    }
    setSavingHoroshop(false);
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

  const horoshopStats = useMemo(() => {
    let activeInstallments = 0;
    let forcedInstallments = 0;
    let disabledInstallments = 0;
    let outOfStock = 0;

    const alwaysSet = new Set(alwaysAvailable.map(s => String(s).trim()));

    catalog.forEach(p => {
      const code = p.vendorCode ? String(p.vendorCode).trim() : '';
      const isDisabled = horoshopDisabledSet.has(code);
      const isAlways = alwaysSet.has(code);
      const isAvailable = availabilityOverrides[code] !== false;
      let stock = stockOverrides[code] !== undefined ? parseInt(stockOverrides[code], 10) : 0;
      if (isAlways) stock = Math.max(stock, 10);
      if (isNaN(stock) || stock < 0) stock = 0;

      if (isDisabled) {
        disabledInstallments++;
      } else {
        const hasInstallments = isAlways || (isAvailable && stock > 0);
        if (hasInstallments) {
          activeInstallments++;
          if (isAlways) forcedInstallments++;
        } else {
          outOfStock++;
        }
      }
    });

    return {
      total: catalog.length,
      active: activeInstallments,
      forced: forcedInstallments,
      disabled: disabledInstallments,
      outOfStock: outOfStock
    };
  }, [catalog, alwaysAvailable, horoshopDisabledSet, availabilityOverrides, stockOverrides]);

  const filteredHoroshopCatalog = useMemo(() => {
    const q = horoshopSearchQuery.toLowerCase().trim();
    const alwaysSet = new Set(alwaysAvailable.map(s => String(s).trim()));

    return catalog.filter(p => {
      const code = p.vendorCode ? String(p.vendorCode).trim() : '';
      const name = p.name || '';
      if (q) {
        const matchesQuery = name.toLowerCase().includes(q) || code.toLowerCase().includes(q);
        if (!matchesQuery) return false;
      }
      if (horoshopCategoryFilter !== 'all' && (p.category || 'Без категорії') !== horoshopCategoryFilter) {
        return false;
      }

      const isDisabled = horoshopDisabledSet.has(code);
      const isAlways = alwaysSet.has(code);
      const isAvailable = availabilityOverrides[code] !== false;
      let stock = stockOverrides[code] !== undefined ? parseInt(stockOverrides[code], 10) : 0;
      if (isAlways) stock = Math.max(stock, 10);
      if (isNaN(stock) || stock < 0) stock = 0;

      const hasInstallments = !isDisabled && (isAlways || (isAvailable && stock > 0));

      if (horoshopFilterMode === 'active') return hasInstallments;
      if (horoshopFilterMode === 'forced') return isAlways && !isDisabled;
      if (horoshopFilterMode === 'disabled') return isDisabled;
      if (horoshopFilterMode === 'out_of_stock') return !isDisabled && !hasInstallments;

      return true;
    });
  }, [catalog, horoshopSearchQuery, horoshopCategoryFilter, horoshopFilterMode, alwaysAvailable, horoshopDisabledSet, availabilityOverrides, stockOverrides]);

  const horoshopGrouped = useMemo(() => {
    const map = {};
    for (const product of filteredHoroshopCatalog) {
      const cat = product.category || 'Без категорії';
      if (!map[cat]) map[cat] = [];
      map[cat].push(product);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b, 'uk'));
  }, [filteredHoroshopCatalog]);

  const getHoroshopCategoryStats = (products) => {
    let activeCount = 0;
    products.forEach(p => {
      const code = p.vendorCode ? String(p.vendorCode).trim() : '';
      const isDisabled = horoshopDisabledSet.has(code);
      const isAlways = alwaysAvailable.includes(code);
      const isAvailable = availabilityOverrides[code] !== false;
      let stock = stockOverrides[code] !== undefined ? parseInt(stockOverrides[code], 10) : 0;
      if (isAlways) stock = Math.max(stock, 10);
      if (isNaN(stock) || stock < 0) stock = 0;
      if (!isDisabled && (isAlways || (isAvailable && stock > 0))) {
        activeCount++;
      }
    });
    return { active: activeCount, total: products.length };
  };

  const toggleCategoryHoroshopAllowed = (products) => {
    const codes = products
      .map(p => p.vendorCode ? String(p.vendorCode).trim() : '')
      .filter(Boolean);
    if (codes.length === 0) return;

    const allAllowed = codes.every(c => !horoshopDisabledSet.has(c));
    setHoroshopDisabled(prev => {
      const prevSet = new Set(prev);
      codes.forEach(c => {
        if (allAllowed) prevSet.add(c);
        else prevSet.delete(c);
      });
      return Array.from(prevSet);
    });
    showToast(allAllowed ? `🔴 Заборонено ОЧ для категорії (${codes.length} тов.)` : `🟢 Дозволено ОЧ для категорії (${codes.length} тов.)`);
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

  // Фільтрація для пошуку (плоский список) та статусу
  const filteredCatalog = useMemo(() => {
    let result = catalog;
    
    if (filterMode === 'enabled') {
      result = result.filter(p => whitelist.includes(p.vendorCode));
    } else if (filterMode === 'no_barcode') {
      result = result.filter(p => !barcodes[p.vendorCode] && !p.barcode);
    }
    
    if (!searchQuery.trim()) return result;
    
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
    return result;
  }, [catalog, searchQuery, filterMode, whitelist, barcodes]);

  const grouped = useMemo(() => {
    const map = {};
    let baseCatalog = catalog;
    if (filterMode === 'enabled') {
      baseCatalog = catalog.filter(p => whitelist.includes(p.vendorCode));
    } else if (filterMode === 'no_barcode') {
      baseCatalog = catalog.filter(p => !barcodes[p.vendorCode] && !p.barcode);
    }
    for (const product of baseCatalog) {
      const cat = product.category || 'Без категорії';
      if (!map[cat]) map[cat] = [];
      map[cat].push(product);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b, 'uk'));
  }, [catalog, filterMode, whitelist, barcodes]);

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

  const toggleCategoryWhitelist = (products) => {
    const codes = products.map(p => p.vendorCode);
    const allOn = codes.every(c => whitelist.includes(c));
    if (allOn) {
      setWhitelist(prev => prev.filter(c => !codes.includes(c)));
    } else {
      setWhitelist(prev => [...new Set([...prev, ...codes])]);
    }
  };

  const handleExportExcel = () => {
    const data = catalog.map(p => {
      return {
        'Артикул': p.vendorCode,
        'Назва': names[p.vendorCode] !== undefined ? names[p.vendorCode] : p.name,
        'Категорія': p.category || 'Без категорії',
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

          if (row['Штрихкод'] !== undefined) {
             if (row['Штрихкод']) {
                 newBarcodes[vendorCode] = String(row['Штрихкод']);
             } else {
                 delete newBarcodes[vendorCode];
             }
          }
        });

        setWhitelist(newWhitelist);
        setNames(newNames);
        setAvailabilityOverrides(newAvailability);
        setBarcodes(newBarcodes);

        showToast(`✅ Успішно оновлено ${updatedCount} товарів з Excel. Не забудьте натиснути "Зберегти зміни".`);
      } catch (err) {
        console.error(err);
        showToast('❌ Помилка імпорту файлу Excel.');
      }
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const handleSyncGoogleSheets = async () => {
    if (!googleSheets || googleSheets.length === 0) {
      showToast('⚠️ Немає налаштованих Google Таблиць у src/google-sheets.json');
      return;
    }
    setSyncing(true);
    showToast('🔄 Синхронізація залишків з Google Sheets...');
    try {
      const keywords = {
        article: ['артикул', 'артікул', 'vendor code', 'vendor_code'],
        warehouses: ['ридомиль', 'в.олександівка 1', 'в.олександівка 2', 'с.борщагівка', 'київ1', 'київ2', 'київ 1', 'київ 2']
      };

      const newStock = { ...stockOverrides };
      const newAvail = { ...availabilityOverrides };
      let updated = 0;

      for (const sheet of googleSheets) {
        if (!sheet) continue;
        let url = sheet;
        let gid = '';
        const gidMatch = url.match(/gid=([0-9]+)/);
        if (gidMatch) gid = `&gid=${gidMatch[1]}`;
        
        if (url.includes('/edit')) {
          url = url.replace(/\/edit.*/, `/export?format=csv${gid}`);
        } else if (url.includes('/export') && !url.includes('gid=') && gid) {
          url += gid;
        }
        
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Не вдалося завантажити таблицю`);
        const text = await res.text();
        
        const workbook = XLSX.read(text, { type: 'string', raw: true });
        const sheetName = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
        
        let articleIdx = -1;
        let warehouseIndices = [];
        
        for (let i = 0; i < Math.min(20, rows.length); i++) {
          if (!rows[i]) continue;
          rows[i].forEach((cell, idx) => {
            if (!cell) return;
            const val = String(cell).trim().toLowerCase();
            if (keywords.article.includes(val)) articleIdx = idx;
            if (keywords.warehouses.includes(val)) {
              if (!warehouseIndices.includes(idx)) warehouseIndices.push(idx);
            }
          });
        }
        
        if (articleIdx === -1) continue;
        
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row) continue;
          const vendorCode = row[articleIdx] ? String(row[articleIdx]).trim() : null;
          if (!vendorCode || keywords.article.includes(vendorCode.toLowerCase())) continue;
          
          let totalQty = 0;
          for (const wIdx of warehouseIndices) {
            const val = row[wIdx] ? String(row[wIdx]).replace(/\s/g, '').replace(',', '.').trim() : '';
            const qty = parseInt(val, 10);
            if (!isNaN(qty)) totalQty += qty;
          }
          
          newStock[vendorCode] = totalQty;
          newAvail[vendorCode] = totalQty > 0;
          updated++;
        }
      }
      
      setStockOverrides(newStock);
      setAvailabilityOverrides(newAvail);
      showToast(`✅ Синхронізовано ${updated} товарів з Google Таблиць. Натисніть "Зберегти зміни" щоб оновити!`);
    } catch (e) {
      console.error(e);
      showToast('❌ Помилка синхронізації з Google Sheets: ' + e.message);
    }
    setSyncing(false);
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
          <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.2rem' }}>
            {names[code] || product.name}
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
          {!existsOnProm ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.6rem', borderRadius: '6px', background: '#fef3c7', color: '#92400e', fontSize: '0.85rem', fontWeight: 600 }} title="Товар є у фіді Хорошопу, але його артикул не знайдено на Prom.ua">
              ⚠️ Немає на Prom.ua
            </span>
          ) : !isEnabled ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.6rem', borderRadius: '6px', background: '#f3f4f6', color: '#4b5563', fontSize: '0.85rem', fontWeight: 500 }} title="Товар вимкнено для Prom: залишається видимим на сайті, але зі статусом 'Немає в наявності' (0 шт.)">
              ⚪ Вимкнено (Немає в наявн.)
            </span>
          ) : stock > 0 ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.6rem', borderRadius: '6px', background: '#dcfce7', color: '#166534', fontSize: '0.85rem', fontWeight: 600 }}>
              🟢 В наявності ({stock} шт.)
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.6rem', borderRadius: '6px', background: '#fee2e2', color: '#991b1b', fontSize: '0.85rem', fontWeight: 500 }}>
              🔴 Немає в наявності
            </span>
          )}
        </td>
      </tr>
    );
  };

  const renderHoroshopProductRow = (product) => {
    const code = product.vendorCode ? String(product.vendorCode).trim() : '';
    const isDisabled = horoshopDisabledSet.has(code);
    const isAlways = alwaysAvailable.includes(code);
    const isAvailable = availabilityOverrides[code] !== false;
    let stock = stockOverrides[code] !== undefined ? parseInt(stockOverrides[code], 10) : 0;
    if (isAlways) stock = Math.max(stock, 10);
    if (isNaN(stock) || stock < 0) stock = 0;

    const hasInstallments = !isDisabled && (isAlways || (isAvailable && stock > 0));

    return (
      <tr
        key={product.id || code}
        style={{
          borderBottom: '1px solid var(--border-color)',
          background: isDisabled
            ? 'rgba(254, 242, 242, 0.45)'
            : isAlways
              ? 'rgba(245, 243, 255, 0.45)'
              : (stock > 0 ? 'transparent' : 'rgba(243, 244, 246, 0.4)'),
          transition: 'background 0.2s'
        }}
      >
        <td style={{ padding: '0.85rem', textAlign: 'center' }}>
          <label className="toggle-switch" title={isDisabled ? "Оплата частинами заборонена (натисніть, щоб дозволити)" : "Оплата частинами дозволена (натисніть, щоб заборонити)"}>
            <input
              type="checkbox"
              checked={!isDisabled}
              onChange={() => toggleHoroshopAllowed(code)}
            />
            <span className="slider" style={{ background: !isDisabled ? '#10b981' : '#9ca3af' }}></span>
          </label>
        </td>
        <td style={{ padding: '0.85rem', textAlign: 'center' }}>
          <label className="toggle-switch" style={{ opacity: isDisabled ? 0.35 : 1 }} title={isDisabled ? "Спочатку дозвольте Оплату частинами для цього товару" : "Примусово увімкнути Оплату частинами (6 платежів) навіть при 0 на складі"}>
            <input
              type="checkbox"
              disabled={isDisabled}
              checked={isAlways && !isDisabled}
              onChange={() => toggleAlwaysAvailable(code)}
            />
            <span className="slider" style={{ background: (isAlways && !isDisabled) ? '#8b5cf6' : '' }}></span>
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
          <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.2rem' }}>
            {names[code] || product.name}
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
          {isDisabled ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.6rem', borderRadius: '6px', background: '#fee2e2', color: '#b91c1c', fontSize: '0.85rem', fontWeight: 600 }} title="Оплату частинами заборонено вручну (навіть при наявності товару на складі ОЧ не передається)">
              🔴 ОЧ вимкнено (заборонено)
            </span>
          ) : isAlways ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.6rem', borderRadius: '6px', background: '#f3e8ff', color: '#6b21a8', fontSize: '0.85rem', fontWeight: 600 }} title="Увімкнено примусово через 'Примусово ОЧ'">
              💜 Примусово ОЧ (6 пл.)
            </span>
          ) : hasInstallments ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.6rem', borderRadius: '6px', background: '#dcfce7', color: '#166534', fontSize: '0.85rem', fontWeight: 600 }} title="Товар в наявності на складі — ОЧ активна">
              🟢 ОЧ активна (на складі)
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.6rem', borderRadius: '6px', background: '#f3f4f6', color: '#6b7280', fontSize: '0.85rem', fontWeight: 500 }} title="Товару немає на складі — Оплата частинами вимкнена">
              ⚪ ОЧ вимкнено (0 на складі)
            </span>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="layout-wrapper">
      <div className="sidebar">
        <div className="sidebar-logo">
          <div style={{ background: 'var(--primary)', color: 'white', borderRadius: '8px', padding: '4px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⚡</div> 
          TOTAL ENERGO
        </div>
        <div className="sidebar-menu">
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', margin: '1rem 0 0.5rem 1rem', textTransform: 'uppercase' }}>Система</div>
          <a className={`sidebar-item ${activeTab === 'catalog' || activeTab === 'import' ? 'active' : ''}`} onClick={() => setActiveTab('catalog')}>
            🟡 Мономаркет
          </a>
          <a className={`sidebar-item ${activeTab === 'prom' ? 'active' : ''}`} onClick={() => setActiveTab('prom')}>
            🟣 Prom.ua
          </a>
          <a className={`sidebar-item ${activeTab === 'horoshop' ? 'active' : ''}`} onClick={() => setActiveTab('horoshop')}>
            🟠 Хорошоп
          </a>
          <a className="sidebar-item" onClick={() => { setShowLogs(true); loadLogs(); }}>
            ⏱️ Журнал логів
          </a>
          <a className="sidebar-item" onClick={() => setShowLinks(true)}>
            🔗 XML фіди
          </a>
          <a className="sidebar-item" onClick={() => setShowSettings(true)}>
            ⚙️ Налаштування
          </a>
        </div>
      </div>
      <div className="container">
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
            <h1>🟠 Керування Хорошоп</h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Оплата частинами (monobank) та статуси товарів по API</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              className="btn"
              style={{ background: '#ea580c', color: '#fff' }}
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
            <h1>🟡 Керування Мономаркет</h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Товарний фід та налаштування для маркетплейсу monobank</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="btn" style={{ background: '#0ea5e9' }} onClick={handleSync} disabled={syncing || loading || saving || !token}>
              {syncing ? <span className="loader"></span> : '🔄 Оновити з Хорошопу'}
            </button>
            <button className="btn" style={{ background: '#10b981' }} onClick={handleTriggerFeed} disabled={syncing || loading || saving || !token} title="Запустити генерацію фіду без збереження">
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
            style={{ cursor: 'pointer', border: horoshopFilterMode === 'all' ? '2px solid #ea580c' : '1px solid var(--border-color)', transition: 'all 0.2s', background: horoshopFilterMode === 'all' ? '#fff7ed' : 'transparent' }}
            onClick={() => setHoroshopFilterMode('all')}
            title="Показати всі товари"
          >
            <div className="stat-label">Всього в каталозі</div>
            <div className="stat-value">{horoshopStats.total}</div>
          </div>
          <div
            className="stat-card"
            style={{ cursor: 'pointer', border: horoshopFilterMode === 'active' ? '2px solid var(--success)' : '1px solid var(--border-color)', transition: 'all 0.2s', background: horoshopFilterMode === 'active' ? '#f0fdf4' : 'transparent' }}
            onClick={() => setHoroshopFilterMode('active')}
            title="Фільтр: Оплата частинами активна"
          >
            <div className="stat-label">🟢 Оплата частинами (6 пл.)</div>
            <div className="stat-value" style={{ color: 'var(--success)' }}>{horoshopStats.active}</div>
          </div>
          <div
            className="stat-card"
            style={{ cursor: 'pointer', border: horoshopFilterMode === 'forced' ? '2px solid #8b5cf6' : '1px solid var(--border-color)', transition: 'all 0.2s', background: horoshopFilterMode === 'forced' ? '#f5f3ff' : 'transparent' }}
            onClick={() => setHoroshopFilterMode('forced')}
            title="Фільтр: Примусово увімкнена Оплата частинами"
          >
            <div className="stat-label">💜 Примусово "Оплата частинами"</div>
            <div className="stat-value" style={{ color: '#8b5cf6' }}>{horoshopStats.forced}</div>
          </div>
          <div
            className="stat-card"
            style={{ cursor: 'pointer', border: horoshopFilterMode === 'disabled' ? '2px solid #ef4444' : '1px solid var(--border-color)', transition: 'all 0.2s', background: horoshopFilterMode === 'disabled' ? '#fef2f2' : 'transparent' }}
            onClick={() => setHoroshopFilterMode('disabled')}
            title="Фільтр: Оплата частинами заборонена вручну (навіть якщо є на складі)"
          >
            <div className="stat-label">🔴 Заборонено ОЧ (вручну)</div>
            <div className="stat-value" style={{ color: '#ef4444' }}>{horoshopStats.disabled}</div>
          </div>
          <div
            className="stat-card"
            style={{ cursor: 'pointer', border: horoshopFilterMode === 'out_of_stock' ? '2px solid var(--text-muted)' : '1px solid var(--border-color)', transition: 'all 0.2s', background: horoshopFilterMode === 'out_of_stock' ? '#f9fafb' : 'transparent' }}
            onClick={() => setHoroshopFilterMode('out_of_stock')}
            title="Фільтр: Немає на складі (0 шт.)"
          >
            <div className="stat-label">⚪ Немає на складі (0 шт.)</div>
            <div className="stat-value" style={{ color: 'var(--text-muted)' }}>{horoshopStats.outOfStock}</div>
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
            <div className="stat-value" style={{ color: 'var(--success)' }}>{whitelist.length}</div>
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
      {activeTab !== 'prom' && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <button 
            onClick={() => setActiveTab('catalog')}
            style={{ padding: '0.75rem 1.5rem', background: 'none', border: 'none', borderBottom: activeTab === 'catalog' ? '2px solid #3b82f6' : '2px solid transparent', color: activeTab === 'catalog' ? '#3b82f6' : 'var(--text-main)', cursor: 'pointer', fontWeight: 600, fontSize: '1rem', transition: 'all 0.2s' }}
          >
            📦 Каталог товарів
          </button>
          <button 
            onClick={() => setActiveTab('import')}
            style={{ padding: '0.75rem 1.5rem', background: 'none', border: 'none', borderBottom: activeTab === 'import' ? '2px solid #10b981' : '2px solid transparent', color: activeTab === 'import' ? '#10b981' : 'var(--text-main)', cursor: 'pointer', fontWeight: 600, fontSize: '1rem', transition: 'all 0.2s' }}
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
              Ви можете експортувати поточні налаштування товарів (штрихкоди, назви, наявність та статус увімкнення) в Excel файл, масово відредагувати їх та імпортувати назад.
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
          <select className="input-field" style={{ width: '220px', fontSize: '0.95rem', cursor: 'pointer' }} value={filterMode} onChange={e => setFilterMode(e.target.value)}>
            <option value="all">👁️ Усі товари</option>
            <option value="enabled">🟢 Тільки увімкнені в фід</option>
            <option value="no_barcode">⚠️ Без штрихкоду</option>
          </select>
        </div>
      )}

      {/* Плоскі результати пошуку */}
      {searchQuery.trim() && (
        <div className="glass-panel" style={{ marginBottom: '1rem', padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(59,130,246,0.05)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700 }}>🔍 Результати пошуку</span>
            <span className="badge">{filteredCatalog.length} товарів</span>
            
            {filteredCatalog.length > 0 && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                <button className="btn" style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }} onClick={() => handleBulkAction(true)}>
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
      ) : !searchQuery.trim() ? (
        grouped.map(([categoryName, products]) => {
          const { selected, total } = getCategoryStats(products);
          const isCollapsed = collapsedCategories[categoryName] !== false; // collapsed by default
          const allCatSelected = products.every(p => whitelist.includes(p.vendorCode));

          return (
            <div key={categoryName} className="glass-panel" style={{ marginBottom: '1rem', padding: 0, overflow: 'hidden' }}>
              {/* Category header */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.5rem',
                  cursor: 'pointer', borderBottom: isCollapsed ? 'none' : '1px solid var(--border-color)',
                  background: 'rgba(59,130,246,0.05)'
                }}
              >
                {/* Category toggle switch */}
                <label className="toggle-switch" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={allCatSelected} onChange={() => toggleCategoryWhitelist(products)} />
                  <span className="slider"></span>
                </label>
                {/* Category name + collapse */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem' }} onClick={() => toggleCategory(categoryName)}>
                  <span style={{ fontWeight: 700, fontSize: '1rem' }}>{categoryName}</span>
                  <span className="badge">{selected}/{total}</span>
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }} onClick={() => toggleCategory(categoryName)}>
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
              style={{ width: '275px', fontSize: '0.95rem', cursor: 'pointer' }}
              value={promFilterMode}
              onChange={e => setPromFilterMode(e.target.value)}
            >
              <option value="all">👁️ Усі товари ({catalog.length})</option>
              <option value="no_match">⚠️ Немає збігу артикулу ({promStats.noMatch})</option>
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
                  const validCodes = products
                    .map(p => p.vendorCode ? String(p.vendorCode).trim() : '')
                    .filter(code => code && promSkusSet.has(code));
                  const allCatSelected = validCodes.length > 0 && validCodes.every(c => promWhitelistSet.has(c));

                  return (
                    <div key={categoryName} className="glass-panel" style={{ marginBottom: '0.75rem', padding: 0, overflow: 'hidden' }}>
                      {/* Category header */}
                      <div
                        style={{
                          display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.9rem 1.25rem',
                          cursor: 'pointer', borderBottom: isCollapsed ? 'none' : '1px solid var(--border-color)',
                          background: isCollapsed ? '#ffffff' : 'rgba(139, 92, 246, 0.05)',
                          transition: 'background 0.2s'
                        }}
                      >
                        <label className="toggle-switch" onClick={e => e.stopPropagation()} title={validCodes.length === 0 ? "У цій категорії немає товарів з Prom.ua" : (allCatSelected ? "Вимкнути всю категорію на Prom" : "Увімкнути всю категорію на Prom")}>
                          <input
                            type="checkbox"
                            disabled={validCodes.length === 0}
                            checked={allCatSelected}
                            onChange={() => toggleCategoryPromWhitelist(products)}
                          />
                          <span className="slider" style={{ background: allCatSelected ? '#8b5cf6' : '' }}></span>
                        </label>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem' }} onClick={() => togglePromCategory(categoryName)}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{categoryName}</span>
                          <span className="badge" style={{ background: enabled > 0 ? '#dcfce7' : '#f3f4f6', color: enabled > 0 ? '#15803d' : '#6b7280' }}>
                            {enabled}/{total}
                          </span>
                        </div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '1.1rem', padding: '0 0.5rem' }} onClick={() => togglePromCategory(categoryName)}>
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
          <div style={{ padding: '0.9rem 1.15rem', borderRadius: '8px', background: 'rgba(234, 88, 12, 0.08)', border: '1px solid rgba(234, 88, 12, 0.25)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: '1.45', maxWidth: '850px' }}>
              💡 <strong>Як працює Оплата частинами на Хорошоп:</strong>
              <div style={{ marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div>• 🟢 <strong>Автоматично за складом:</strong> Товари в наявності на складі (&gt; 0 шт.) автоматично отримують статус «Оплата частинами від monobank (6 платежів)».</div>
                <div>• 🔴 <strong>Перемикач «Дозволити ОЧ»:</strong> Якщо вимкнути тумблер — Оплата частинами для товару НЕ передається, навіть коли він є на складі.</div>
                <div>• 💜 <strong>Перемикач «Примусово ОЧ»:</strong> Вмикає 6 платежів навіть коли товару немає на складі (0 шт.), якщо ОЧ не заборонена.</div>
              </div>
            </div>
            <button
              className="btn"
              style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem', background: 'rgba(234, 88, 12, 0.15)', color: '#c2410c', border: '1px solid rgba(234, 88, 12, 0.3)' }}
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
              style={{ width: '280px', fontSize: '0.95rem', cursor: 'pointer' }}
              value={horoshopFilterMode}
              onChange={e => setHoroshopFilterMode(e.target.value)}
            >
              <option value="all">👁️ Усі товари ({catalog.length})</option>
              <option value="active">🟢 Оплата частинами активна ({horoshopStats.active})</option>
              <option value="forced">💜 Тільки "Примусово ОЧ" ({horoshopStats.forced})</option>
              <option value="disabled">🔴 Заборонено вручну ({horoshopStats.disabled})</option>
              <option value="out_of_stock">⚪ Немає на складі ({horoshopStats.outOfStock})</option>
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
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                className="btn"
                style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}
                onClick={() => handleBulkHoroshopAllowed(true)}
                title="Дозволити Оплату частинами для всіх відфільтрованих товарів"
              >
                🟢 Дозволити ОЧ
              </button>
              <button
                className="btn"
                style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}
                onClick={() => handleBulkHoroshopAllowed(false)}
                title="Заборонити Оплату частинами для всіх відфільтрованих товарів (навіть якщо вони є на складі)"
              >
                🔴 Заборонити ОЧ
              </button>
              <button
                className="btn"
                style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem', background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe' }}
                onClick={() => handleBulkHoroshopToggle(true)}
                title="Увімкнути примусову ОЧ для всіх відфільтрованих товарів"
              >
                💜 Примусово ОЧ
              </button>
              <button
                className="btn"
                style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem', background: '#f3f4f6', color: '#4b5563', border: '1px solid #e5e7eb' }}
                onClick={() => handleBulkHoroshopToggle(false)}
                title="Зняти примусову ОЧ для відфільтрованих товарів"
              >
                ⚪ Зняти примусово ОЧ
              </button>
              {!horoshopSearchQuery.trim() && (
                <>
                  <button
                    className="btn"
                    style={{ background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                    onClick={expandAllHoroshop}
                    title="Розгорнути всі категорії"
                  >
                    ▼ Розгорнути всі
                  </button>
                  <button
                    className="btn"
                    style={{ background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
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
                    <th style={{ padding: '1rem', width: '110px', textAlign: 'center' }}>Дозволити ОЧ</th>
                    <th style={{ padding: '1rem', width: '120px', textAlign: 'center' }}>Примусово ОЧ</th>
                    <th style={{ padding: '1rem', width: '60px', textAlign: 'center' }}>Фото</th>
                    <th style={{ padding: '1rem', width: '150px' }}>Артикул</th>
                    <th style={{ padding: '1rem' }}>Назва товару</th>
                    <th style={{ padding: '1rem', width: '110px' }}>Ціна</th>
                    <th style={{ padding: '1rem', width: '120px', textAlign: 'center' }}>Склад (Excel)</th>
                    <th style={{ padding: '1rem', width: '230px' }}>Статус Оплати частинами</th>
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
                  const codes = products
                    .map(p => p.vendorCode ? String(p.vendorCode).trim() : '')
                    .filter(Boolean);
                  const allCatAllowed = codes.length > 0 && codes.every(c => !horoshopDisabledSet.has(c));

                  return (
                    <div key={categoryName} className="glass-panel" style={{ marginBottom: '0.75rem', padding: 0, overflow: 'hidden' }}>
                      {/* Category header */}
                      <div
                        style={{
                          display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.9rem 1.25rem',
                          cursor: 'pointer', borderBottom: isCollapsed ? 'none' : '1px solid var(--border-color)',
                          background: isCollapsed ? '#ffffff' : 'rgba(16, 185, 129, 0.05)',
                          transition: 'background 0.2s'
                        }}
                      >
                        <label className="toggle-switch" onClick={e => e.stopPropagation()} title={allCatAllowed ? "Заборонити ОЧ для всієї категорії" : "Дозволити ОЧ для всієї категорії"}>
                          <input
                            type="checkbox"
                            checked={allCatAllowed}
                            onChange={() => toggleCategoryHoroshopAllowed(products)}
                          />
                          <span className="slider" style={{ background: allCatAllowed ? '#10b981' : '#9ca3af' }}></span>
                        </label>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem' }} onClick={() => toggleHoroshopCategory(categoryName)}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{categoryName}</span>
                          <span className="badge" style={{ background: active > 0 ? '#dcfce7' : '#f3f4f6', color: active > 0 ? '#15803d' : '#6b7280' }}>
                            {active}/{total}
                          </span>
                        </div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '1.1rem', padding: '0 0.5rem' }} onClick={() => toggleHoroshopCategory(categoryName)}>
                          {isCollapsed ? '▶' : '▼'}
                        </span>
                      </div>

                      {/* Category table */}
                      {!isCollapsed && (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.95rem' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                <th style={{ padding: '0.85rem 1rem', width: '110px', textAlign: 'center' }}>Дозволити ОЧ</th>
                                <th style={{ padding: '0.85rem 1rem', width: '120px', textAlign: 'center' }}>Примусово ОЧ</th>
                                <th style={{ padding: '0.85rem 1rem', width: '60px', textAlign: 'center' }}>Фото</th>
                                <th style={{ padding: '0.85rem 1rem', width: '150px' }}>Артикул</th>
                                <th style={{ padding: '0.85rem 1rem' }}>Назва товару</th>
                                <th style={{ padding: '0.85rem 1rem', width: '110px' }}>Ціна</th>
                                <th style={{ padding: '0.85rem 1rem', width: '120px', textAlign: 'center' }}>Склад (Excel)</th>
                                <th style={{ padding: '0.85rem 1rem', width: '230px' }}>Статус Оплати частинами</th>
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
              <label>URL XML-фіду Хорошопу</label>
              <input type="url" className="input-field" value={feedUrl} onChange={e => setFeedUrl(e.target.value)} placeholder="https://..." />
              <small style={{ color: 'var(--text-muted)' }}>Посилання на ваш фід — всі товари з нього з'являться в таблиці.</small>
            </div>
            <div className="form-group">
              <label>🟣 Prom.ua API Bearer Token</label>
              <input type="password" className="input-field" value={promToken} onChange={e => setPromToken(e.target.value)} placeholder="d24092..." />
              <small style={{ color: 'var(--text-muted)' }}>Токен доступу до REST API Prom.ua (Кабінет компанії → Налаштування → Керування API-токенами).</small>
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
