import { useState, useEffect, useMemo } from 'react';
import { GitHubApi } from './api';
import './index.css';

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

  // File SHAs for updating
  const [shas, setShas] = useState({
    whitelist: null,
    barcodes: null,
    descriptions: null,
    config: null
  });

  const api = useMemo(() => new GitHubApi(token, 'yaroslavtotalenergo', 'horoshop-monomarket-feed'), [token]);

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load Catalog
      const catRes = await api.getFile('feeds/catalog.json');
      if (catRes.content) {
        setCatalog(JSON.parse(catRes.content));
      }

      // Load Whitelist
      const wlRes = await api.getFile('src/whitelist.json');
      if (wlRes.content) setWhitelist(JSON.parse(wlRes.content));

      // Load Barcodes
      const bcRes = await api.getFile('src/barcodes.json');
      if (bcRes.content) setBarcodes(JSON.parse(bcRes.content));

      // Load Descriptions
      const descRes = await api.getFile('src/descriptions.json');
      if (descRes.content) setDescriptions(JSON.parse(descRes.content));

      // Load Config
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
      showToast('Error loading data! Check token.');
    }
    setLoading(false);
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      // Save Whitelist
      const wlRes = await api.saveFile('src/whitelist.json', JSON.stringify(whitelist, null, 2), shas.whitelist, 'Update whitelist via Admin Panel');
      
      // Save Barcodes
      const bcRes = await api.saveFile('src/barcodes.json', JSON.stringify(barcodes, null, 2), shas.barcodes, 'Update barcodes via Admin Panel');
      
      // Save Descriptions
      const descRes = await api.saveFile('src/descriptions.json', JSON.stringify(descriptions, null, 2), shas.descriptions, 'Update descriptions via Admin Panel');

      // Update SHAs
      setShas({
        ...shas,
        whitelist: wlRes.content.sha,
        barcodes: bcRes.content.sha,
        descriptions: descRes.content.sha
      });

      // Trigger Workflow to regenerate feeds immediately
      await api.triggerWorkflow();

      showToast('Дані успішно збережено! Фід оновлюється...');
    } catch (e) {
      console.error(e);
      showToast('Помилка при збереженні!');
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

  const updateBarcode = (vendorCode, value) => {
    setBarcodes({ ...barcodes, [vendorCode]: value });
  };

  const updateDescription = (vendorCode, value) => {
    setDescriptions({ ...descriptions, [vendorCode]: value });
  };

  return (
    <div className="container">
      <div className="header">
        <div>
          <h1>Monomarket Feed Admin</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Керування товарами для маркетплейсу</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
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
                <th style={{ width: '60px' }}>Увімк</th>
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
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Артикул: {product.vendorCode} | {product.price} ₴</div>
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

      {showSettings && (
        <div className="modal-overlay">
          <div className="glass-panel modal">
            <h2>Налаштування підключення</h2>
            <div className="form-group">
              <label>GitHub Personal Access Token</label>
              <input 
                type="password" 
                className="input-field" 
                value={token} 
                onChange={e => setToken(e.target.value)} 
                placeholder="ghp_..."
              />
              <small style={{ color: 'var(--text-muted)' }}>Потрібен для збереження змін на GitHub. Зберігається лише у вашому браузері.</small>
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
              <small style={{ color: 'var(--text-muted)' }}>Посилання на ваш фід. Усі товари з нього будуть доступні в таблиці.</small>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
              <button className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={() => setShowSettings(false)}>Скасувати</button>
              <button className="btn success" onClick={handleSaveSettings} disabled={saving}>
                {saving ? 'Збереження...' : 'Зберегти'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
