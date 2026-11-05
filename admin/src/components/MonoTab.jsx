import React, { useState, useMemo } from 'react';
import { isHoroshopOutOfStock, buildHierarchicalGroups, matchesCategoryFilter, getDaysToDispatch } from '../utils/helpers';

export default function MonoTab({
  catalog = [],
  whitelist = [],
  setWhitelist,
  availabilityOverrides = {},
  setAvailabilityOverrides,
  stockOverrides = {},
  setStockOverrides,
  names = {},
  setNames,
  barcodes = {},
  setBarcodes,
  descriptions = {},
  setDescriptions,
  videos = {},
  setVideos,
  categoryTree = [],
  token,
  api,
  loading,
  saving,
  syncing,
  showToast,
  searchQuery,
  setSearchQuery,
  filterMode,
  setFilterMode,
  monoCategoryFilter,
  setMonoCategoryFilter,
  setEditingDescriptionProduct,
  handleSaveAll,
  handleTriggerFeed
}) {
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [collapsedSubCategories, setCollapsedSubCategories] = useState({});

  const defaultDaysToDispatch = getDaysToDispatch();
  const getDaysColor = (days) => {
    if (days === 5) return '#8b5cf6';
    if (days === 3) return '#f59e0b';
    if (days === 2) return '#0ea5e9';
    return '#10b981';
  };

  const toggleWhitelist = (vendorCode) => {
    setWhitelist(prev => prev.includes(vendorCode) ? prev.filter(v => v !== vendorCode) : [...prev, vendorCode]);
  };

  const toggleAvailability = (vendorCode) => {
    setAvailabilityOverrides(prev => {
      const next = { ...prev };
      if (next[vendorCode] === false) {
        next[vendorCode] = true;
      } else {
        next[vendorCode] = false;
      }
      return next;
    });
  };

  const updateStock = (vendorCode, amount) => {
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

  const updateBarcode = (vendorCode, value) => setBarcodes(prev => ({ ...prev, [vendorCode]: value }));

  const allSelected = catalog.length > 0 && catalog.every(p => whitelist.includes(p.vendorCode));
  const handleToggleAll = () => setWhitelist(allSelected ? [] : catalog.map(p => p.vendorCode));

  const toggleMonoCategory = (cat) => setCollapsedCategories(prev => {
    const isCurrentlyCollapsed = prev[cat] !== false;
    return { ...prev, [cat]: !isCurrentlyCollapsed };
  });

  const toggleMonoSubCategory = (subPath) => setCollapsedSubCategories(prev => {
    const isCurrentlyCollapsed = prev[subPath] !== false;
    return { ...prev, [subPath]: !isCurrentlyCollapsed };
  });

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

    if (monoCategoryFilter !== 'all') {
      result = result.filter(p => matchesCategoryFilter(p.category, monoCategoryFilter));
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
  }, [catalog, searchQuery, filterMode, monoCategoryFilter, whitelist, barcodes, stockOverrides]);

  const monoGrouped = useMemo(() => {
    return buildHierarchicalGroups(filteredCatalog);
  }, [filteredCatalog]);

  const getCategoryStats = (products) => {
    const selected = products.filter(p => whitelist.includes(p.vendorCode)).length;
    return { selected, total: products.length };
  };

  const expandAllMono = () => {
    const nextMain = {};
    const nextSub = {};
    monoGrouped.forEach(g => {
      nextMain[g.main] = false;
      g.subs.forEach(s => { nextSub[s.fullPath] = false; });
    });
    setCollapsedCategories(nextMain);
    setCollapsedSubCategories(nextSub);
  };

  const collapseAllMono = () => {
    const nextMain = {};
    monoGrouped.forEach(g => { nextMain[g.main] = true; });
    setCollapsedCategories(nextMain);
    setCollapsedSubCategories({});
  };

  const handleBulkAction = (turnOn) => {
    const codes = filteredCatalog.map(p => p.vendorCode);
    if (turnOn) {
      setWhitelist(prev => [...new Set([...prev, ...codes])]);
    } else {
      setWhitelist(prev => prev.filter(c => !codes.includes(c)));
    }
  };

  const handleBulkCategoryAction = (turnOn, productList = filteredCatalog) => {
    const codes = productList.map(p => p.vendorCode).filter(Boolean);
    if (turnOn) {
      setWhitelist(prev => [...new Set([...prev, ...codes])]);
      showToast(`✅ Увімкнено ${codes.length} товарів`);
    } else {
      const codeSet = new Set(codes);
      setWhitelist(prev => prev.filter(c => !codeSet.has(c)));
      showToast(`❌ Вимкнено ${codes.length} товарів`);
    }
  };

  const renderMonoProductRow = (product) => {
    const isSelected = whitelist.includes(product.vendorCode);
    const isAvailable = availabilityOverrides[product.vendorCode] !== false;
    const currentName = names[product.vendorCode] !== undefined ? names[product.vendorCode] : product.name;
    const charCount = currentName.length;
    const isOverLimit = charCount > 50;
    const productDays = getDaysToDispatch(product.category);
    const prodDaysColor = getDaysColor(productDays);

    return (
      <tr key={product.vendorCode} style={{ opacity: isSelected ? 1 : 0.5, borderBottom: '1px solid var(--border-color)' }}>
        <td style={{ textAlign: 'center', padding: '0.65rem 0.5rem' }}>
          <label className="toggle-switch">
            <input type="checkbox" checked={isSelected} onChange={() => toggleWhitelist(product.vendorCode)} />
            <span className="slider"></span>
          </label>
        </td>
        <td style={{ textAlign: 'center', padding: '0.65rem 0.5rem' }}>
          <label className="toggle-switch" style={{ opacity: isSelected ? 1 : 0.4 }}>
            <input type="checkbox" checked={isAvailable} disabled={!isSelected} onChange={() => toggleAvailability(product.vendorCode)} />
            <span className="slider" style={{ background: isAvailable ? '#10b981' : '#f87171' }}></span>
          </label>
        </td>
        <td style={{ padding: '0.65rem 0.5rem' }}>
          <input
            type="number"
            min="0"
            className="input-field"
            style={{ width: '100%', padding: '0.4rem', textAlign: 'center' }}
            value={stockOverrides[product.vendorCode] !== undefined ? stockOverrides[product.vendorCode] : (product.stock ?? 10)}
            onChange={(e) => updateStock(product.vendorCode, e.target.value === '' ? '' : parseInt(e.target.value, 10))}
            onBlur={(e) => { if (e.target.value === '') updateStock(product.vendorCode, 10); }}
          />
        </td>
        <td style={{ padding: '0.65rem 0.75rem' }}>
          <div className="flex-center">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
              <div style={{ flex: 1, width: '100%' }}>
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
        <td style={{ textAlign: 'center', padding: '0.65rem 0.5rem' }}>
          <span
            title={productDays === 5 ? 'Комплекти: термін відправки завжди 5 днів' : `Термін відправки: ${productDays} дн.`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: prodDaysColor + '20',
              border: '1px solid ' + prodDaysColor + '60',
              color: prodDaysColor,
              fontWeight: 700,
              fontSize: '0.9rem'
            }}
          >
            {productDays}
          </span>
        </td>
        <td style={{ padding: '0.65rem 0.5rem' }}>
          <input
            type="text"
            className="input-field"
            placeholder="Ввести..."
            value={barcodes[product.vendorCode] || ''}
            onChange={(e) => updateBarcode(product.vendorCode, e.target.value)}
          />
        </td>
        <td style={{ padding: '0.65rem 0.5rem' }}>
          {descriptions[product.vendorCode] ? (
            <button className="btn" style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', width: '100%', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.2)' }} onClick={() => setEditingDescriptionProduct(product)}>
              Опис додано ✏️
            </button>
          ) : (
            <button className="btn" style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', width: '100%', background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--border-color)' }} onClick={() => setEditingDescriptionProduct(product)}>
              ✏️ Редагувати опис
            </button>
          )}
        </td>
      </tr>
    );
  };

  const renderMonoTable = (products) => (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ tableLayout: 'fixed', width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <th style={{ width: '60px', textAlign: 'center', padding: '0.75rem 0.5rem' }}>Увімк</th>
            <th style={{ width: '90px', textAlign: 'center', padding: '0.75rem 0.5rem' }}>Наявність</th>
            <th style={{ width: '80px', textAlign: 'center', padding: '0.75rem 0.5rem' }}>Залишок</th>
            <th style={{ padding: '0.75rem' }}>Товар</th>
            <th style={{ width: '55px', textAlign: 'center', padding: '0.75rem 0.25rem' }}>Дні</th>
            <th style={{ width: '145px', padding: '0.75rem 0.5rem' }}>Штрихкод</th>
            <th style={{ width: '155px', padding: '0.75rem 0.5rem' }}>Кастомний опис</th>
          </tr>
        </thead>
        <tbody>
          {products.map(product => renderMonoProductRow(product))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="header">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', background: '#18181b', color: '#ffffff', fontSize: '1.1rem' }}>🐾</span>
            Керування Мономаркет
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Товарний фід та налаштування для маркетплейсу monobank</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn" style={{ background: '#18181b', color: '#ffffff', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} onClick={handleTriggerFeed} disabled={syncing || loading || saving || !token} title="Запустити генерацію фіду без збереження">
            {syncing ? <span className="loader"></span> : `⚡ Запустити фід (${defaultDaysToDispatch}д)`}
          </button>
          <button className="btn success" onClick={handleSaveAll} disabled={saving || syncing || loading || !token}>
            {saving ? <span className="loader"></span> : '💾 Зберегти зміни'}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
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
          <div className="stat-value">{monoGrouped.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Штрихкодів</div>
          <div className="stat-value">{Object.keys(barcodes).length}</div>
        </div>
      </div>

      {/* Search and Filters */}
      {!loading && catalog.length > 0 && (
        <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
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

          <select
            className="input-field"
            style={{ width: 'auto', minWidth: '260px', fontSize: '0.95rem', cursor: 'pointer' }}
            value={monoCategoryFilter}
            onChange={e => setMonoCategoryFilter(e.target.value)}
          >
            <option value="all">📁 Усі категорії ({categoryTree.length} груп)</option>
            {categoryTree.map(group => (
              <optgroup key={group.main} label={`${group.main} (${group.products.length})`}>
                <option value={`main:${group.main}`}>↳ Всі «{group.main}» ({group.products.length})</option>
                {group.subs.length > 1 && group.subs.map(sub => (
                  <option key={sub.fullPath} value={`sub:${sub.fullPath}`}>
                    &nbsp;&nbsp;&nbsp;• {sub.name} ({sub.products.length})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      )}

      {/* Quick bulk and category counters */}
      {!searchQuery.trim() && catalog.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Знайдено груп: <strong style={{ color: 'var(--text-main)' }}>{monoGrouped.length}</strong>
            {monoCategoryFilter !== 'all' && ` (фільтр активний)`}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn"
              style={{ background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
              onClick={expandAllMono}
              title="Розгорнути всі категорії"
            >
              ▼ Розгорнути всі
            </button>
            <button
              className="btn"
              style={{ background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
              onClick={collapseAllMono}
              title="Згорнути всі категорії"
            >
              ▶ Згорнути всі
            </button>
          </div>
        </div>
      )}

      {/* Flat search results */}
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
            renderMonoTable(filteredCatalog)
          )}
        </div>
      )}

      {/* Global Toggle */}
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
      ) : !searchQuery.trim() && monoGrouped.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          🎉 За вибраним фільтром товарів не знайдено!
        </div>
      ) : !searchQuery.trim() ? (
        monoGrouped.map(group => {
          const { selected, total } = getCategoryStats(group.products);
          const isMainCollapsed = collapsedCategories[group.main] !== undefined
            ? collapsedCategories[group.main]
            : (monoCategoryFilter === 'all' && filterMode === 'all');
          const hasMultipleSubs = group.subs.length > 1 || (group.subs[0] && group.subs[0].name !== 'Основні товари' && group.subs[0].name !== group.main);

          return (
            <div key={group.main} className="glass-panel" style={{ marginBottom: '1rem', padding: 0, overflow: 'hidden' }}>
              {/* Primary Category Header */}
              <div
                onClick={() => toggleMonoCategory(group.main)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem',
                  cursor: 'pointer', borderBottom: isMainCollapsed ? 'none' : '1px solid var(--border-color)',
                  background: isMainCollapsed ? '#ffffff' : 'rgba(24, 24, 27, 0.04)',
                  transition: 'background 0.2s', userSelect: 'none'
                }}
              >
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '1.15rem' }}>📁</span>
                  <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>{group.main}</span>
                  <span className="badge" style={{ background: selected > 0 ? '#18181b' : '#f3f4f6', color: selected > 0 ? '#ffffff' : '#6b7280', fontSize: '0.85rem', padding: '0.2rem 0.55rem' }}>
                    {selected}/{total} увімкнено
                  </span>
                  {group.subs.length > 1 && (
                    <span style={{ fontSize: '0.8rem', color: '#64748b', background: '#f1f5f9', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                      {group.subs.length} підкатегорій
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.35rem', marginRight: '0.75rem' }} onClick={e => e.stopPropagation()}>
                  <button
                    type="button"
                    className="btn"
                    style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem', background: '#18181b', color: '#ffffff' }}
                    onClick={() => handleBulkCategoryAction(true, group.products)}
                    title="Увімкнути всі товари цієї категорії"
                  >
                    ✅ Всі ({total})
                  </button>
                  <button
                    type="button"
                    className="btn"
                    style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem', background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1' }}
                    onClick={() => handleBulkCategoryAction(false, group.products)}
                    title="Вимкнути всі товари цієї категорії"
                  >
                    ❌ Зняти
                  </button>
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
                  {isMainCollapsed ? '▶' : '▼'}
                </span>
              </div>

              {/* Expanded Main Category Content */}
              {!isMainCollapsed && (
                !hasMultipleSubs ? (
                  renderMonoTable(group.subs[0] ? group.subs[0].products : group.products)
                ) : (
                  <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', background: '#f8fafc' }}>
                    {group.subs.map(sub => {
                      const subStats = getCategoryStats(sub.products);
                      const isSubFiltered = monoCategoryFilter === `sub:${sub.fullPath}` || monoCategoryFilter === sub.fullPath;
                      const isSubCollapsed = isSubFiltered
                        ? false
                        : (collapsedSubCategories[sub.fullPath] !== false);

                      return (
                        <div key={sub.fullPath} style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                          <div
                            onClick={() => toggleMonoSubCategory(sub.fullPath)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.65rem 1rem',
                              cursor: 'pointer', background: isSubCollapsed ? '#ffffff' : '#f1f5f9',
                              borderBottom: isSubCollapsed ? 'none' : '1px solid #e2e8f0',
                              transition: 'background 0.15s', userSelect: 'none'
                            }}
                          >
                            <span style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 700 }}>↳</span>
                            <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#1e293b' }}>{sub.name}</span>
                            <span className="badge" style={{ background: subStats.selected > 0 ? '#18181b' : '#f1f5f9', color: subStats.selected > 0 ? '#ffffff' : '#64748b', fontSize: '0.8rem', padding: '0.15rem 0.45rem' }}>
                              {subStats.selected}/{subStats.total}
                            </span>
                            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.35rem' }} onClick={e => e.stopPropagation()}>
                              <button
                                type="button"
                                className="btn"
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', background: '#f8fafc', color: '#1e293b', border: '1px solid #cbd5e1' }}
                                onClick={() => handleBulkCategoryAction(true, sub.products)}
                                title="Увімкнути товари підкатегорії"
                              >
                                ✅ Всі
                              </button>
                              <button
                                type="button"
                                className="btn"
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', background: '#ffffff', color: '#64748b', border: '1px solid #e2e8f0' }}
                                onClick={() => handleBulkCategoryAction(false, sub.products)}
                                title="Вимкнути товари підкатегорії"
                              >
                                ❌ Зняти
                              </button>
                            </div>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem', paddingLeft: '0.35rem' }}>
                              {isSubCollapsed ? '▶' : '▼'}
                            </span>
                          </div>
                          {!isSubCollapsed && renderMonoTable(sub.products)}
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          );
        })
      ) : null}
    </div>
  );
}

