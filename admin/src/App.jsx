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

const REPO_OWNER = 'yaroslavtotalenergo';
const REPO_NAME = 'horoshop-monomarket-feed';
const FEED_URLS = {
  xml: `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/feeds/products.xml`,
  json: `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/feeds/prices.json`,
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
  const [barcodes, setBarcodes] = useState({});
  const [descriptions, setDescriptions] = useState({});
  const [availabilityOverrides, setAvailabilityOverrides] = useState({});
  const [names, setNames] = useState({});

  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  
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
      const [catalogRes, whitelistRes, barcodesRes, descRes, configRes, availRes, namesRes] = await Promise.all([
        api.getFile('feeds/catalog.json'),
        api.getFile('src/whitelist.json'),
        api.getFile('src/barcodes.json'),
        api.getFile('src/descriptions.json'),
        api.getFile('src/config.json'),
        api.getFile('src/availability.json'),
        api.getFile('src/names.json')
      ]);

      if (catalogRes.content) {
        const parsed = JSON.parse(catalogRes.content);
        setCatalog(Array.isArray(parsed) ? parsed : (parsed.data || []));
      }
      if (whitelistRes.content) setWhitelist(JSON.parse(whitelistRes.content) || []);
      if (barcodesRes.content) setBarcodes(JSON.parse(barcodesRes.content) || {});
      if (descRes.content) setDescriptions(JSON.parse(descRes.content) || {});
      if (availRes.content) setAvailabilityOverrides(JSON.parse(availRes.content) || {});
      if (namesRes.content) setNames(JSON.parse(namesRes.content) || {});
      if (configRes.content) setFeedUrl(JSON.parse(configRes.content).horoshopFeedUrl || '');
      
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

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      // Save files sequentially to avoid concurrent SHA conflicts
      await api.saveFile('src/whitelist.json', JSON.stringify(whitelist, null, 2), null, 'Update whitelist via UI');
      await api.saveFile('src/barcodes.json', JSON.stringify(barcodes, null, 2), null, 'Update barcodes via UI');
      await api.saveFile('src/descriptions.json', JSON.stringify(descriptions, null, 2), null, 'Update descriptions via UI');
      await api.saveFile('src/availability.json', JSON.stringify(availabilityOverrides, null, 2), null, 'Update availability via UI');
      await api.saveFile('src/names.json', JSON.stringify(names, null, 2), null, 'Update custom names via UI');
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
      loadData();
    } catch (e) { console.error(e); }
    setSaving(false);
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
  const copyToClipboard = (text) => { navigator.clipboard.writeText(text); showToast('📋 Посилання скопійовано!'); };

  const toggleCategory = (cat) => setCollapsedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));

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

  return (
    <div className="container">
      <div className="header">
        <div>
          <h1>Monomarket Feed Admin</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Керування товарами для маркетплейсу</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn" style={{ background: '#7c3aed' }} onClick={() => setShowLinks(true)}>
            🔗 Посилання
          </button>
          <button className="btn" style={{ background: '#f59e0b', color: '#fff' }} onClick={() => { setShowLogs(true); loadLogs(); }}>
            📝 Історія
          </button>
          <button className="btn" onClick={() => setShowSettings(true)}>⚙️ Налаштування</button>
          <button className="btn" style={{ background: '#0ea5e9' }} onClick={handleSync} disabled={syncing || loading || saving || !token}>
            {syncing ? <span className="loader"></span> : '🔄 Оновити з Хорошопу'}
          </button>
          <button className="btn success" onClick={handleSaveAll} disabled={saving || syncing || loading || !token}>
            {saving ? <span className="loader"></span> : '💾 Зберегти зміни'}
          </button>
        </div>
      </div>

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
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>Увімк</th>
                    <th style={{ width: '90px' }}>Наявність</th>
                    <th style={{ width: '100%', minWidth: '400px' }}>Товар</th>
                    <th style={{ width: '60px', textAlign: 'center' }}>Дні</th>
                    <th style={{ width: '160px' }}>Штрихкод</th>
                    <th style={{ width: '170px' }}>Кастомний опис (HTML)</th>
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
                <table>
                    <thead>
                      <tr>
                        <th style={{ width: '60px' }}>Увімк</th>
                        <th style={{ width: '90px' }}>Наявність</th>
                        <th style={{ width: '100%', minWidth: '400px' }}>Товар</th>
                        <th style={{ width: '60px', textAlign: 'center' }}>Дні</th>
                        <th style={{ width: '160px' }}>Штрихкод</th>
                        <th style={{ width: '170px' }}>Кастомний опис (HTML)</th>
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
              <button className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={() => setShowSettings(false)}>Скасувати</button>
              <button className="btn success" onClick={handleSaveSettings} disabled={saving}>{saving ? 'Збереження...' : '✅ Зберегти'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
