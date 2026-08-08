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
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [showSettings, setShowSettings] = useState(!token);
  const [showLinks, setShowLinks] = useState(false);

  // File SHAs for updating
  const [shas, setShas] = useState({
    whitelist: null,
    barcodes: null,
    descriptions: null,
    config: null
  });

  const api = useMemo(() => new GitHubApi(token, REPO_OWNER, REPO_NAME), [token]);

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token]);

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
      if (confRes.content) {
        const conf = JSON.parse(confRes.content);
        setFeedUrl(conf.horoshopFeedUrl || '');
      }

      setShas({
        whitelist: wlRes.sha,
        barcodes: bcRes.sha,
        descriptions: descRes.sha,
        config: confRes.sha
      });
    } catch (e) {
      showToast('Помилка завантаження! Перевірте токен.');
    }
    setLoading(false);
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const wlRes = await api.saveFile('src/whitelist.json', JSON.stringify(whitelist, null, 2), shas.whitelist, 'Update whitelist via Admin Panel');
      const bcRes = await api.saveFile('src/barcodes.json', JSON.stringify(barcodes, null, 2), shas.barcodes, 'Update barcodes via Admin Panel');
      const descRes = await api.saveFile('src/descriptions.json', JSON.stringify(descriptions, null, 2), shas.descriptions, 'Update descriptions via Admin Panel');

      setShas({
        ...shas,
        whitelist: wlRes.content.sha,
        barcodes: bcRes.content.sha,
        descriptions: descRes.content.sha
      });

      await api.triggerWorkflow();
      showToast('✅ Дані збережено! Фід оновлюється...');
    } catch (e) {
      console.error(e);
      showToast('❌ Помилка при збереженні!');
    }
    setSaving(false);
  };

  const handleSaveSettings = async () => {
    localStorage.setItem('gh_token', token);
    setShowSettings(false);
    setSaving(true);
    try {
      const configObj = { horoshopFeedUrl: feedUrl };
      const confRes = await api.saveFile('src/config.json', JSON.stringify(configObj, null, 2), shas.config, 'Update config via Admin Panel');
      setShas({ ...shas, config: confRes.content.sha });
      loadData();
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const toggleWhitelist = (vendorCode) => {
    if (whitelist.includes(vendorCode)) {
      setWhitelist(whitelist.filter(v => v !== vendorCode));
    } else {
      setWhitelist([...whitelist, vendorCode]);
    }
  };

  // Select All / Deselect All
  const allSelected = catalog.length > 0 && catalog.every(p => whitelist.includes(p.vendorCode));
  const handleToggleAll = () => {
    if (allSelected) {
      setWhitelist([]);
    } else {
      setWhitelist(catalog.map(p => p.vendorCode));
    }
  };

  const updateBarcode = (vendorCode, value) => {
    setBarcodes({ ...barcodes, [vendorCode]: value });
  };

  const updateDescription = (vendorCode, value) => {
    setDescriptions({ ...descriptions, [vendorCode]: value });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast('📋 Посилання скопійовано!');
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
            🔗 Посилання для Мономаркету
          </button>
          <button className="btn" onClick={() => setShowSettings(true)}>
            ⚙️ Налаштування
          </button>
          <button 
            className="btn success" 
            onClick={handleSaveAll}
            disabled={saving || loading || !token}
          >
            {saving ? <span className="loader"></span> : '💾 Зберегти зміни'}
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Всього товарів у фіді</div>
          <div className="stat-value">{catalog.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Відмічено для Мономаркету</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{whitelist.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Кастомних штрихкодів</div>
          <div className="stat-value">{Object.keys(barcodes).length}</div>
        </div>
      </div>

      <div className="glass-panel" style={{ overflowX: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <span className="loader" style={{ width: '40px', height: '40px', borderWidth: '3px' }}></span>
            <p>Завантаження даних з GitHub...</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: '60px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <label className="toggle-switch" title={allSelected ? 'Зняти всі галочки' : 'Відмітити всі'}>
                      <input 
                        type="checkbox" 
                        checked={allSelected}
                        onChange={handleToggleAll}
                      />
                      <span className="slider"></span>
                    </label>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                      {allSelected ? 'Зняти всі' : 'Усі'}
                    </span>
                  </div>
                </th>
                <th>Товар</th>
                <th style={{ width: '200px' }}>Штрихкод</th>
                <th>Кастомний опис (HTML)</th>
              </tr>
            </thead>
            <tbody>
              {catalog.map(product => {
                const isSelected = whitelist.includes(product.vendorCode);
                return (
                  <tr key={product.vendorCode} style={{ opacity: isSelected ? 1 : 0.5 }}>
                    <td>
                      <label className="toggle-switch">
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => toggleWhitelist(product.vendorCode)}
                        />
                        <span className="slider"></span>
                      </label>
                    </td>
                    <td>
                      <div className="flex-center">
                        {product.picture && <img src={product.picture} className="product-img" alt="" />}
                        <div>
                          <div style={{ fontWeight: '500' }}>{product.name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Артикул: {product.vendorCode} | {product.price} ₴
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <input 
                        type="text" 
                        className="input-field" 
                        placeholder="Ввести..."
                        value={barcodes[product.vendorCode] || ''}
                        onChange={(e) => updateBarcode(product.vendorCode, e.target.value)}
                      />
                    </td>
                    <td>
                      <textarea 
                        className="input-field" 
                        placeholder="Залишити пустим для стандартного..."
                        rows="2"
                        style={{ resize: 'vertical' }}
                        value={descriptions[product.vendorCode] || ''}
                        onChange={(e) => updateDescription(product.vendorCode, e.target.value)}
                      ></textarea>
                    </td>
                  </tr>
                );
              })}
              {catalog.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    Немає товарів. Переконайтеся, що ви вказали правильне посилання на фід Хорошопу в налаштуваннях.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Посилання для Мономаркету */}
      {showLinks && (
        <div className="modal-overlay" onClick={() => setShowLinks(false)}>
          <div className="glass-panel modal" onClick={e => e.stopPropagation()}>
            <h2>🔗 Посилання для Мономаркету</h2>
            <p style={{ color: 'var(--text-muted)' }}>
              Вставте ці посилання у ваш кабінет Мономаркету. Вони постійні — дані в них оновлюються автоматично кожні 30 хвилин.
            </p>

            <div className="form-group">
              <label>📦 Товарний фід (XML) — назви, описи, фото, характеристики</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  className="input-field" 
                  value={FEED_URLS.xml} 
                  readOnly 
                  style={{ fontFamily: 'monospace', fontSize: '0.8rem', cursor: 'text' }}
                />
                <button className="btn" style={{ flexShrink: 0 }} onClick={() => copyToClipboard(FEED_URLS.xml)}>
                  📋 Копіювати
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>💰 Прайс-лист (JSON) — ціни, наявність, залишки</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  className="input-field" 
                  value={FEED_URLS.json} 
                  readOnly 
                  style={{ fontFamily: 'monospace', fontSize: '0.8rem', cursor: 'text' }}
                />
                <button className="btn" style={{ flexShrink: 0 }} onClick={() => copyToClipboard(FEED_URLS.json)}>
                  📋 Копіювати
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button className="btn success" onClick={() => setShowLinks(false)}>Закрити</button>
            </div>
          </div>
        </div>
      )}

      {/* Налаштування */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="glass-panel modal" onClick={e => e.stopPropagation()}>
            <h2>⚙️ Налаштування підключення</h2>
            <div className="form-group">
              <label>GitHub Personal Access Token</label>
              <input 
                type="password" 
                className="input-field" 
                value={token} 
                onChange={e => setToken(e.target.value)} 
                placeholder="ghp_..."
              />
              <small style={{ color: 'var(--text-muted)' }}>
                Потрібен для збереження змін на GitHub. Зберігається лише у вашому браузері.
              </small>
            </div>
            <div className="form-group">
              <label>URL XML-фіду Хорошопу</label>
              <input 
                type="url" 
                className="input-field" 
                value={feedUrl} 
                onChange={e => setFeedUrl(e.target.value)} 
                placeholder="https://..."
              />
              <small style={{ color: 'var(--text-muted)' }}>
                Посилання на ваш фід. Усі товари з нього будуть доступні в таблиці.
              </small>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
              <button 
                className="btn" 
                style={{ background: 'transparent', border: '1px solid var(--border-color)' }} 
                onClick={() => setShowSettings(false)}
              >
                Скасувати
              </button>
              <button className="btn success" onClick={handleSaveSettings} disabled={saving}>
                {saving ? 'Збереження...' : '✅ Зберегти'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
