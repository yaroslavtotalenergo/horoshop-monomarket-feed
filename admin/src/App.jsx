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
import * as XLSX from 'xlsx';
import './index.css';

import LoginGate from './components/LoginGate';
import PromTab from './components/PromTab';
import HoroshopTab from './components/HoroshopTab';
import MonoTab from './components/MonoTab';
import StockLogModal from './components/StockLogModal';
import { REPO_OWNER, REPO_NAME, FEED_URLS, buildHierarchicalGroups } from './utils/helpers';

export { LoginGate };

const BtnH3 = createButton('Заголовок H3', <b style={{ fontSize: '12px' }}>H3</b>, () => document.execCommand('formatBlock', false, 'H3'));

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('gh_token') || '');
  const [catalog, setCatalog] = useState([]);
  const [whitelist, setWhitelist] = useState([]);
  const [alwaysAvailable, setAlwaysAvailable] = useState([]);
  const [barcodes, setBarcodes] = useState({});
  const [descriptions, setDescriptions] = useState({});
  const [availabilityOverrides, setAvailabilityOverrides] = useState({});
  const [stockOverrides, setStockOverrides] = useState({});
  const [names, setNames] = useState({});
  const [videos, setVideos] = useState({});

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [monoCategoryFilter, setMonoCategoryFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('prom');
  const [syncingAll, setSyncingAll] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  
  const [promWhitelist, setPromWhitelist] = useState([]);
  const [promSkus, setPromSkus] = useState([]);
  const [promSearchQuery, setPromSearchQuery] = useState('');
  const [promFilterMode, setPromFilterMode] = useState('all');
  
  const [horoshopSearchQuery, setHoroshopSearchQuery] = useState('');
  const [horoshopFilterMode, setHoroshopFilterMode] = useState('all');
  const [horoshopPresence, setHoroshopPresence] = useState({});
  const [horoshopInstallments, setHoroshopInstallments] = useState({});
  
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
  const [lastSeenStockTime, setLastSeenStockTime] = useState(() => {
    try { return localStorage.getItem('last_seen_stock_time') || ''; } catch { return ''; }
  });

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
      const [catalogRes, whitelistRes, barcodesRes, descRes, configRes, availRes, stockRes, namesRes, videosRes, alwaysAvailRes, promWhitelistRes, promSkusRes, horoshopPresenceRes, horoshopInstallmentsRes, stockChangesRes] = await Promise.all([
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
      if (horoshopPresenceRes && horoshopPresenceRes.content) {
        try { setHoroshopPresence(JSON.parse(horoshopPresenceRes.content) || {}); } catch { }
      }
      if (horoshopInstallmentsRes && horoshopInstallmentsRes.content) {
        try { setHoroshopInstallments(JSON.parse(horoshopInstallmentsRes.content) || {}); } catch { }
      }
      if (barcodesRes.content) setBarcodes(JSON.parse(barcodesRes.content) || {});
      if (descRes.content) setDescriptions(JSON.parse(descRes.content) || {});
      if (availRes.content) setAvailabilityOverrides(JSON.parse(availRes.content) || {});
      if (stockRes.content) setStockOverrides(JSON.parse(stockRes.content) || {});
      if (namesRes.content) setNames(JSON.parse(namesRes.content) || {});
      if (videosRes && videosRes.content) setVideos(JSON.parse(videosRes.content) || {});
      
      if (promWhitelistRes && promWhitelistRes.content) {
        try { setPromWhitelist(JSON.parse(promWhitelistRes.content) || []); } catch { }
      }
      if (promSkusRes && promSkusRes.content) {
        try { setPromSkus(JSON.parse(promSkusRes.content) || []); } catch { }
      }
      
      if (stockChangesRes && stockChangesRes.content) {
        try {
          const parsedChanges = JSON.parse(stockChangesRes.content);
          if (Array.isArray(parsedChanges)) setStockChanges(parsedChanges);
        } catch { }
      }

      setShas({
        whitelist: whitelistRes.sha,
        barcodes: barcodesRes.sha,
        descriptions: descRes.sha,
        stockChanges: stockChangesRes ? stockChangesRes.sha : null,
        config: configRes.sha
      });
    } catch {
      showToast('Помилка завантаження! Перевірте токен.');
    }
    setLoading(false);
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

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
    try { localStorage.setItem('last_seen_stock_time', now); } catch { }
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

  const handleTriggerFeed = async () => {
    setSyncing(true);
    try {
      await api.triggerWorkflow();
      showToast('✅ Фід запущено! Оновлюється (~1 хв)');
    } catch (e) {
      showToast('❌ Помилка запуску: ' + (e?.message || ''));
    }
    setSyncing(false);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await api.saveFile('src/whitelist.json', JSON.stringify(whitelist, null, 2), null, 'Update whitelist via UI');
      await api.saveFile('src/always-available.json', JSON.stringify(alwaysAvailable, null, 2), null, 'Update always available via UI');
      await api.saveFile('src/barcodes.json', JSON.stringify(barcodes, null, 2), null, 'Update barcodes via UI');
      await api.saveFile('src/descriptions.json', JSON.stringify(descriptions, null, 2), null, 'Update descriptions via UI');
      
      const cleanStock = { ...stockOverrides };
      for (const k in cleanStock) {
        if (cleanStock[k] === '') cleanStock[k] = 10;
      }
      
      await api.saveFile('src/availability.json', JSON.stringify(availabilityOverrides, null, 2), null, 'Update availability via UI');
      await api.saveFile('src/stock.json', JSON.stringify(cleanStock, null, 2), null, 'Update stock via UI');
      await api.saveFile('src/names.json', JSON.stringify(names, null, 2), null, 'Update custom names via UI');
      await api.saveFile('src/videos.json', JSON.stringify(videos, null, 2), null, 'Update custom videos via UI');
      await api.triggerWorkflow();
      showToast('✅ Дані збережено! Фід оновлюється...');
    } catch (e) {
      console.error('Save error:', e);
      showToast('❌ Помилка: ' + (e?.message || 'невідома помилка'));
    }
    setSaving(false);
  };

  const handleSaveSettings = async () => {
    localStorage.setItem('gh_token', token);
    setShowSettings(false);
    showToast('✅ Налаштування збережено');
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

  const handleSyncHoroshop = async () => {
    setSyncing(true);
    showToast('⏳ Запущено оновлення з Хорошопу. Очікуємо завершення генерації...');
    try {
      const startTime = Date.now();
      await api.triggerWorkflow();

      for (let i = 0; i < 22; i++) {
        await new Promise(r => setTimeout(r, 4000));
        try {
          const runs = await api.getWorkflowRuns(5);
          const currentRun = runs.find(r => r.name === 'Update Monomarket Feeds' && new Date(r.created_at).getTime() >= startTime - 15000);
          if (currentRun && currentRun.status === 'completed') {
            break;
          }
        } catch { }
      }

      await loadData();
      showToast('✅ Дані успішно оновлено з Хорошопу!');
    } catch (e) {
      console.error(e);
      showToast('❌ Помилка оновлення. Спробуйте пізніше.');
    } finally {
      setSyncing(false);
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

  const copyToClipboard = (text) => { 
    navigator.clipboard.writeText(text); 
    showToast('📋 Посилання скопійовано!'); 
  };

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

  const categoryTree = useMemo(() => {
    return buildHierarchicalGroups(catalog);
  }, [catalog]);

  const handleExportExcel = () => {
    const data = catalog.map(p => {
      let stock = stockOverrides[p.vendorCode] !== undefined ? parseInt(stockOverrides[p.vendorCode], 10) : (p.stock ?? 0);
      if (isNaN(stock) || stock < 0) stock = 0;
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

        setWhitelist(newWhitelist);
        setNames(newNames);
        setAvailabilityOverrides(newAvailability);
        setBarcodes(newBarcodes);
        setStockOverrides(newStock);

        showToast(`✅ Успішно оновлено ${updatedCount} товарів з Excel. Не забудьте натиснути "Зберегти зміни".`);
      } catch (err) {
        console.error(err);
        showToast('❌ Помилка обробки файлу Excel');
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="app">
      {/* Toast Notification */}
      {toast && (
        <div className="toast" style={{
          position: 'fixed', bottom: '2rem', right: '2rem',
          background: 'rgba(15, 23, 42, 0.95)', color: '#fff',
          padding: '0.85rem 1.4rem', borderRadius: '10px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(8px)', zIndex: 9999, fontWeight: 500,
          animation: 'slideUp 0.3s ease-out'
        }}>
          {toast}
        </div>
      )}

      {/* Global Sidebar */}
      <div className="sidebar">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.05rem', boxShadow: '0 2px 4px rgba(37, 99, 235, 0.3)' }}>
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
          <a className={`sidebar-item mono ${activeTab === 'catalog' ? 'active' : ''}`} onClick={() => setActiveTab('catalog')}>
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
              background: '#4360a0',
              color: '#ffffff',
              fontWeight: 600,
              padding: '0.55rem 1.15rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: '0 1px 3px rgba(67, 96, 160, 0.3)'
            }}
            onClick={handleSyncHoroshop}
            disabled={syncing || loading || saving || !token}
            title="Запустити оновлення товарів та залишків з Хорошопу через GitHub Actions"
          >
            {syncing ? <span className="loader" style={{ width: '16px', height: '16px' }}></span> : '🔄 Оновити з Хорошопу'}
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

        {/* Tab Switcher for Mono & Excel */}
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

        {/* 1. Prom Tab */}
        {activeTab === 'prom' && (
          <PromTab
            catalog={catalog}
            promWhitelist={promWhitelist}
            setPromWhitelist={setPromWhitelist}
            promSkus={promSkus}
            stockOverrides={stockOverrides}
            names={names}
            token={token}
            api={api}
            loading={loading}
            showToast={showToast}
            loadData={loadData}
            loadLogs={loadLogs}
            promSearchQuery={promSearchQuery}
            setPromSearchQuery={setPromSearchQuery}
            promFilterMode={promFilterMode}
            setPromFilterMode={setPromFilterMode}
          />
        )}

        {/* 2. Horoshop Tab */}
        {activeTab === 'horoshop' && (
          <HoroshopTab
            catalog={catalog}
            stockOverrides={stockOverrides}
            names={names}
            horoshopPresence={horoshopPresence}
            setHoroshopPresence={setHoroshopPresence}
            horoshopInstallments={horoshopInstallments}
            setHoroshopInstallments={setHoroshopInstallments}
            categoryTree={categoryTree}
            token={token}
            api={api}
            loading={loading}
            showToast={showToast}
            copyToClipboard={copyToClipboard}
            horoshopSearchQuery={horoshopSearchQuery}
            setHoroshopSearchQuery={setHoroshopSearchQuery}
            horoshopFilterMode={horoshopFilterMode}
            setHoroshopFilterMode={setHoroshopFilterMode}
          />
        )}

        {/* 3. Monomarket Tab */}
        <div style={{ display: activeTab === 'catalog' ? 'block' : 'none' }}>
          <MonoTab
            catalog={catalog}
            whitelist={whitelist}
            setWhitelist={setWhitelist}
            availabilityOverrides={availabilityOverrides}
            setAvailabilityOverrides={setAvailabilityOverrides}
            stockOverrides={stockOverrides}
            setStockOverrides={setStockOverrides}
            names={names}
            setNames={setNames}
            barcodes={barcodes}
            setBarcodes={setBarcodes}
            descriptions={descriptions}
            setDescriptions={setDescriptions}
            videos={videos}
            setVideos={setVideos}
            categoryTree={categoryTree}
            token={token}
            api={api}
            loading={loading}
            saving={saving}
            syncing={syncing}
            showToast={showToast}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            filterMode={filterMode}
            setFilterMode={setFilterMode}
            monoCategoryFilter={monoCategoryFilter}
            setMonoCategoryFilter={setMonoCategoryFilter}
            setEditingDescriptionProduct={setEditingDescriptionProduct}
            handleSaveAll={handleSaveAll}
            handleTriggerFeed={handleTriggerFeed}
          />
        </div>

        {/* 4. Excel Import / Export Tab */}
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
      </div>

      {/* Stock Changes Log Modal */}
      <StockLogModal
        show={showStockLog}
        onClose={() => setShowStockLog(false)}
        stockChanges={stockChanges}
        stockOverrides={stockOverrides}
        onClearStockLog={handleClearStockLog}
        navigateToHoroshop={navigateToHoroshop}
        navigateToProm={navigateToProm}
        navigateToMono={navigateToMono}
        copyToClipboard={copyToClipboard}
      />

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

      {/* Logs Modal */}
      {showLogs && (
        <div className="modal-overlay" onClick={() => setShowLogs(false)}>
          <div className="glass-panel modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h2>📝 Історія оновлень</h2>
            <p style={{ color: 'var(--text-muted)' }}>Останні запуски відправки фідів на GitHub.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem', maxHeight: '350px', overflowY: 'auto' }}>
              {workflowRuns.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>Немає історії запусків</div>
              ) : (
                workflowRuns.map(run => (
                  <div key={run.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{run.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(run.created_at).toLocaleString('uk-UA')}</div>
                    </div>
                    <div>
                      <span className={`badge ${run.conclusion === 'success' ? 'badge-success' : run.status === 'in_progress' ? 'badge-warning' : 'badge-danger'}`} style={{
                        padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem',
                        background: run.conclusion === 'success' ? '#dcfce7' : run.status === 'in_progress' ? '#fef3c7' : '#fee2e2',
                        color: run.conclusion === 'success' ? '#15803d' : run.status === 'in_progress' ? '#b45309' : '#b91c1c'
                      }}>
                        {run.status === 'in_progress' ? 'В процесі...' : run.conclusion === 'success' ? 'Успішно' : 'Помилка'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button className="btn success" onClick={() => setShowLogs(false)}>Закрити</button>
            </div>
          </div>
        </div>
      )}

      {/* Links Modal */}
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

      {/* Settings Modal */}
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
    </div>
  );
}
