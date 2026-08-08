import { useState, useEffect, useMemo } from 'react';
import { GitHubApi } from './api';
import './index.css';

const REPO_OWNER = 'yaroslavtotalenergo';
const REPO_NAME = 'horoshop-monomarket-feed';
const FEED_URLS = {
  xml: `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/feeds/products.xml`,
  json: `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/feeds/prices.json`,
};

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('gh_token') || '');
  const [feedUrl, setFeedUrl] = useState('');
  const [catalog, setCatalog] = useState([]);
  const [whitelist, setWhitelist] = useState([]);
  const [barcodes, setBarcodes] = useState({});
  const [descriptions, setDescriptions] = useState({});
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [showSettings, setShowSettings] = useState(!token);
  const [showLinks, setShowLinks] = useState(false);

  const [shas, setShas] = useState({ whitelist: null, barcodes: null, descriptions: null, config: null });

  const api = useMemo(() => new GitHubApi(token, REPO_OWNER, REPO_NAME), [token]);

  useEffect(() => { if (token) loadData(); }, [token]);

  const loadData = async () => {
    setLoading(true);
    try {
      const catRes = await api.getFile('feeds/catalog.json');
      if (catRes.content) setCatalog(JSON.parse(catRes.content));
      const wlRes = await api.getFile('src/whitelist.json');
      if (wlRes.content) setWhitelist(JSON.parse(wlRes.content));
      const bcRes = await api.getFile('src/barcodes.json');
      if (bcRes.content) setBarcodes(JSON.parse(bcRes.content));
      const descRes = await api.getFile('src/descriptions.json');
      if (descRes.content) setDescriptions(JSON.parse(descRes.content));
      const confRes = await api.getFile('src/config.json');
      if (confRes.content) setFeedUrl(JSON.parse(confRes.content).horoshopFeedUrl || '');
      setShas({ whitelist: wlRes.sha, barcodes: bcRes.sha, descriptions: descRes.sha, config: confRes.sha });
    } catch (e) {
      showToast('Помилка завантаження! Перевірте токен.');
    }
    setLoading(false);
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const wlRes = await api.saveFile('src/whitelist.json', JSON.stringify(whitelist, null, 2), shas.whitelist, 'Update whitelist via Admin Panel');
      const bcRes = await api.saveFile('src/barcodes.json', JSON.stringify(barcodes, null, 2), shas.barcodes, 'Update barcodes via Admin Panel');
      const descRes = await api.saveFile('src/descriptions.json', JSON.stringify(descriptions, null, 2), shas.descriptions, 'Update descriptions via Admin Panel');
      setShas({ ...shas, whitelist: wlRes.content.sha, barcodes: bcRes.content.sha, descriptions: descRes.content.sha });
      await api.triggerWorkflow();
      showToast('✅ Дані збережено! Фід оновлюється...');
    } catch (e) {
      showToast('❌ Помилка при збереженні!');
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

  const allSelected = catalog.length > 0 && catalog.every(p => whitelist.includes(p.vendorCode));
  const handleToggleAll = () => setWhitelist(allSelected ? [] : catalog.map(p => p.vendorCode));

  const updateBarcode = (vendorCode, value) => setBarcodes(prev => ({ ...prev, [vendorCode]: value }));
  const updateDescription = (vendorCode, value) => setDescriptions(prev => ({ ...prev, [vendorCode]: value }));
  const copyToClipboard = (text) => { navigator.clipboard.writeText(text); showToast('📋 Посилання скопійовано!'); };

  const toggleCategory = (cat) => setCollapsedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));

  // Фільтрація для пошуку (плоский список)
  const filteredCatalog = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.trim().toLowerCase();
    return catalog.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.vendorCode?.toLowerCase().includes(q) ||
      String(p.price).includes(q)
    );
  }, [catalog, searchQuery]);

  const grouped = useMemo(() => {
    const map = {};
    for (const product of catalog) {
      const cat = product.category || 'Без категорії';
      if (!map[cat]) map[cat] = [];
      map[cat].push(product);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b, 'uk'));
  }, [catalog]);

  const getCategoryStats = (products) => {
    const selected = products.filter(p => whitelist.includes(p.vendorCode)).length;
    return { selected, total: products.length };
  };

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
          <button className="btn" onClick={() => setShowSettings(true)}>⚙️ Налаштування</button>
          <button className="btn success" onClick={handleSaveAll} disabled={saving || loading || !token}>
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

      {/* Search */}
      {!loading && catalog.length > 0 && (
        <div style={{ marginBottom: '1rem', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1.1rem', pointerEvents: 'none' }}>🔍</span>
          <input
            type="text"
            className="input-field"
            placeholder="Пошук за назвою, артикулом або ціною..."
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
      )}

      {/* Плоскі результати пошуку */}
      {searchQuery.trim() && (
        <div className="glass-panel" style={{ marginBottom: '1rem', padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(59,130,246,0.05)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontWeight: 700 }}>🔍 Результати пошуку</span>
            <span className="badge">{filteredCatalog.length} товарів</span>
          </div>
          {filteredCatalog.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Нічого не знайдено</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>Увімк</th>
                    <th>Товар</th>
                    <th style={{ width: '200px' }}>Штрихкод</th>
                    <th>Кастомний опис (HTML)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCatalog.map(product => {
                    const isSelected = whitelist.includes(product.vendorCode);
                    return (
                      <tr key={product.vendorCode} style={{ opacity: isSelected ? 1 : 0.5 }}>
                        <td>
                          <label className="toggle-switch">
                            <input type="checkbox" checked={isSelected} onChange={() => toggleWhitelist(product.vendorCode)} />
                            <span className="slider"></span>
                          </label>
                        </td>
                        <td>
                          <div className="flex-center">
                            {product.picture && <img src={product.picture} className="product-img" alt="" />}
                            <div>
                              <div style={{ fontWeight: '500' }}>{product.name}</div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {product.vendorCode} | {product.price} ₴ | {product.category}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <input type="text" className="input-field" placeholder="Ввести..."
                            value={barcodes[product.vendorCode] || ''}
                            onChange={(e) => updateBarcode(product.vendorCode, e.target.value)}
                          />
                        </td>
                        <td>
                          <textarea className="input-field" placeholder="Залишити пустим..." rows="2" style={{ resize: 'vertical' }}
                            value={descriptions[product.vendorCode] || ''}
                            onChange={(e) => updateDescription(product.vendorCode, e.target.value)}
                          ></textarea>
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
              {!isCollapsed && (
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: '60px' }}>Увімк</th>
                        <th>Товар</th>
                        <th style={{ width: '200px' }}>Штрихкод</th>
                        <th>Кастомний опис (HTML)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map(product => {
                        const isSelected = whitelist.includes(product.vendorCode);
                        return (
                          <tr key={product.vendorCode} style={{ opacity: isSelected ? 1 : 0.5 }}>
                            <td>
                              <label className="toggle-switch">
                                <input type="checkbox" checked={isSelected} onChange={() => toggleWhitelist(product.vendorCode)} />
                                <span className="slider"></span>
                              </label>
                            </td>
                            <td>
                              <div className="flex-center">
                                {product.picture && <img src={product.picture} className="product-img" alt="" />}
                                <div>
                                  <div style={{ fontWeight: '500' }}>{product.name}</div>
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    {product.vendorCode} | {product.price} ₴
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <input type="text" className="input-field" placeholder="Ввести..."
                                value={barcodes[product.vendorCode] || ''}
                                onChange={(e) => updateBarcode(product.vendorCode, e.target.value)}
                              />
                            </td>
                            <td>
                              <textarea className="input-field" placeholder="Залишити пустим для стандартного..." rows="2"
                                style={{ resize: 'vertical' }}
                                value={descriptions[product.vendorCode] || ''}
                                onChange={(e) => updateDescription(product.vendorCode, e.target.value)}
                              ></textarea>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })
      ) : null}

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
