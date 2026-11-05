import React, { useState, useMemo } from 'react';
import { isHoroshopOutOfStock, buildHierarchicalGroups, matchesCategoryFilter } from '../utils/helpers';

export default function PromTab({
  catalog = [],
  promWhitelist = [],
  setPromWhitelist,
  promSkus = [],
  stockOverrides = {},
  names = {},
  token,
  api,
  loading,
  showToast,
  loadData,
  loadLogs,
  promSearchQuery,
  setPromSearchQuery,
  promFilterMode,
  setPromFilterMode
}) {
  const [syncingProm, setSyncingProm] = useState(false);
  const [savingProm, setSavingProm] = useState(false);
  const [promCategoryFilter, setPromCategoryFilter] = useState('all');
  const [collapsedPromCategories, setCollapsedPromCategories] = useState({});
  const [collapsedPromSubCategories, setCollapsedPromSubCategories] = useState({});

  const promSkusList = useMemo(() => {
    if (Array.isArray(promSkus)) return promSkus;
    if (promSkus && Array.isArray(promSkus.skus)) return promSkus.skus;
    return [];
  }, [promSkus]);

  const promItemsMap = useMemo(() => {
    if (promSkus && promSkus.items && typeof promSkus.items === 'object') return promSkus.items;
    return {};
  }, [promSkus]);

  const promSkusSet = useMemo(() => new Set(promSkusList.map(s => String(s).trim())), [promSkusList]);
  const promWhitelistSet = useMemo(() => new Set(promWhitelist.map(s => String(s).trim())), [promWhitelist]);

  const fullPromCatalog = useMemo(() => {
    const list = [...catalog];
    const catalogCodes = new Set(
      catalog.map(p => (p.vendorCode ? String(p.vendorCode).trim() : ''))
    );

    promSkusList.forEach(sku => {
      const code = String(sku).trim();
      if (code && !catalogCodes.has(code)) {
        const item = promItemsMap[code];
        list.push({
          id: item ? `prom-${item.id}` : `prom-${code}`,
          vendorCode: code,
          name: (item && item.name) || names[code] || `Товар ${code}`,
          price: (item && item.price) || 0,
          category: 'Тільки на Prom.ua',
          picture: (item && item.main_image) || null,
          stock: stockOverrides[code] !== undefined ? stockOverrides[code] : 0,
          available: false,
          horoshopAvailable: false,
          onlyOnProm: true,
          promItem: item
        });
      }
    });

    return list;
  }, [catalog, promSkusList, promItemsMap, names, stockOverrides]);

  const promCategoryTree = useMemo(() => {
    return buildHierarchicalGroups(fullPromCatalog);
  }, [fullPromCatalog]);

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
      } catch {
        showToast('✅ Збережено! (Оновиться за графіком або натисніть "Синхронізувати")');
      }
    } catch (e) {
      console.error('Prom save error:', e);
      showToast('❌ Помилка: ' + (e?.message || 'невідома'));
    }
    setSavingProm(false);
  };

  const handleRefreshProm = async () => {
    setSyncingProm(true);
    showToast('⏳ Опитуємо Prom.ua та оновлюємо список артикулів...');
    try {
      const startTime = Date.now();
      await api.triggerWorkflow();

      for (let i = 0; i < 30; i++) {
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
      showToast('✅ Список товарів та артикулів з Prom.ua успішно оновлено!');
    } catch (e) {
      console.error(e);
      showToast('❌ Помилка оновлення з Prom.ua: ' + (e?.message || ''));
    } finally {
      setSyncingProm(false);
      loadLogs();
    }
  };

  const handlePushStockToProm = async () => {
    setSyncingProm(true);
    showToast('⏳ Передаємо залишки та наявність на Prom.ua...');
    try {
      const startTime = Date.now();
      await api.triggerWorkflow();

      for (let i = 0; i < 30; i++) {
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
      showToast('✅ Залишки та наявність успішно відправлено на Prom.ua!');
    } catch (e) {
      console.error(e);
      showToast('❌ Помилка синхронізації: ' + (e?.message || ''));
    } finally {
      setSyncingProm(false);
      loadLogs();
    }
  };

  const handlePromBulkListToggle = (enable, productList = filteredPromCatalog) => {
    const targetCodes = productList
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

  const handleBulkPromToggle = (enable) => handlePromBulkListToggle(enable, filteredPromCatalog);

  const filteredPromCatalog = useMemo(() => {
    const q = promSearchQuery.toLowerCase().trim();

    const filtered = fullPromCatalog.filter(p => {
      const code = p.vendorCode ? String(p.vendorCode).trim() : '';
      const name = p.name || '';
      if (q) {
        const matchesQuery = name.toLowerCase().includes(q) || code.toLowerCase().includes(q);
        if (!matchesQuery) return false;
      }
      if (promCategoryFilter !== 'all' && !matchesCategoryFilter(p.category, promCategoryFilter)) {
        return false;
      }
      const isEnabled = promWhitelistSet.has(code);
      const existsOnProm = promSkusSet.has(code);
      const hasExcel = stockOverrides[code] !== undefined;
      let stock = hasExcel ? parseInt(stockOverrides[code], 10) : 0;
      if (isNaN(stock) || stock < 0) stock = 0;
      const horoOut = isHoroshopOutOfStock(p);

      if (promFilterMode === 'only_on_prom') return !!p.onlyOnProm;
      if (promFilterMode === 'no_match') return !existsOnProm;
      if (promFilterMode === 'out_of_stock_horoshop') return horoOut && !p.onlyOnProm;
      if (promFilterMode === 'enabled') return isEnabled && existsOnProm;
      if (promFilterMode === 'disabled') return !isEnabled && existsOnProm;
      if (promFilterMode === 'in_stock') return isEnabled && existsOnProm && stock > 0;
      if (promFilterMode === 'out_of_stock') return isEnabled && existsOnProm && stock === 0;

      return true;
    });

    return filtered;
  }, [fullPromCatalog, promSearchQuery, promCategoryFilter, promFilterMode, promWhitelistSet, stockOverrides, promSkusSet]);

  const promStats = useMemo(() => {
    let enabledCount = 0;
    let inStockCount = 0;
    let outOfStockCount = 0;
    let disabledCount = 0;
    let noMatchCount = 0;
    let outOfStockHoroshopCount = 0;
    let onlyOnPromCount = 0;

    fullPromCatalog.forEach(p => {
      const code = p.vendorCode ? String(p.vendorCode).trim() : '';
      const isEnabled = promWhitelistSet.has(code);
      const existsOnProm = promSkusSet.has(code);
      let stock = stockOverrides[code] !== undefined ? parseInt(stockOverrides[code], 10) : 0;
      if (isNaN(stock) || stock < 0) stock = 0;

      if (p.onlyOnProm) {
        onlyOnPromCount++;
      } else if (isHoroshopOutOfStock(p)) {
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
      total: fullPromCatalog.length,
      enabled: enabledCount,
      inStock: inStockCount,
      outOfStock: outOfStockCount,
      disabled: disabledCount,
      noMatch: noMatchCount,
      outOfStockHoroshop: outOfStockHoroshopCount,
      onlyOnProm: onlyOnPromCount
    };
  }, [fullPromCatalog, promWhitelistSet, stockOverrides, promSkusSet]);

  const promGrouped = useMemo(() => {
    return buildHierarchicalGroups(filteredPromCatalog);
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

  const togglePromSubCategory = (subPath) => setCollapsedPromSubCategories(prev => {
    const isCurrentlyCollapsed = prev[subPath] !== false;
    return { ...prev, [subPath]: !isCurrentlyCollapsed };
  });

  const expandAllProm = () => {
    const nextMain = {};
    const nextSub = {};
    promGrouped.forEach(g => {
      nextMain[g.main] = false;
      g.subs.forEach(s => { nextSub[s.fullPath] = false; });
    });
    setCollapsedPromCategories(nextMain);
    setCollapsedPromSubCategories(nextSub);
  };

  const collapseAllProm = () => {
    const nextMain = {};
    const nextSub = {};
    promGrouped.forEach(g => {
      nextMain[g.main] = true;
      g.subs.forEach(s => { nextSub[s.fullPath] = true; });
    });
    setCollapsedPromCategories(nextMain);
    setCollapsedPromSubCategories(nextSub);
  };

  const renderPromProductRow = (product) => {
    const code = product.vendorCode ? String(product.vendorCode).trim() : '';
    const isEnabled = promWhitelistSet.has(code);
    const existsOnProm = promSkusSet.has(code);
    let stock = stockOverrides[code] !== undefined ? parseInt(stockOverrides[code], 10) : 0;
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
            {product.onlyOnProm ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.75rem',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  background: '#ede9fe',
                  color: '#6d28d9',
                  fontWeight: 600,
                  whiteSpace: 'nowrap'
                }}
                title="Товар є на Prom.ua, але відсутній у вивантаженні Хорошопу"
              >
                🟣 Тільки на Prom.ua
              </span>
            ) : isHoroshopOutOfStock(product) ? (
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
            ) : null}
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

            {promItemsMap[code] && (
              <span style={{ fontSize: '0.73rem', color: '#6d28d9', background: '#f5f3ff', border: '1px solid #ddd6fe', padding: '0.12rem 0.45rem', borderRadius: '4px', fontWeight: 600 }} title={`ID товару в системі Prom: ${promItemsMap[code].id}`}>
                Пром: {promItemsMap[code].presenceTitle || (promItemsMap[code].presence === 'available' ? 'В наявності' : 'Немає')} ({promItemsMap[code].quantity ?? 0} шт.)
              </span>
            )}

            {existsOnProm && stockOverrides[code] === undefined && (
              <span style={{ fontSize: '0.72rem', color: '#4338ca', background: '#e0e7ff', padding: '0.12rem 0.45rem', borderRadius: '4px', fontWeight: 600 }}>
                ❓ Немає в Excel-складі
              </span>
            )}
            {existsOnProm && isEnabled && stock > 0 && !product.onlyOnProm && isHoroshopOutOfStock(product) && (
              <span style={{ fontSize: '0.72rem', color: '#b91c1c', background: '#fee2e2', padding: '0.12rem 0.45rem', borderRadius: '4px', fontWeight: 600 }}>
                ⚠️ На сайті Хорошоп: «Немає»
              </span>
            )}
          </div>
        </td>
      </tr>
    );
  };

  const renderPromTable = (products) => (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.95rem' }}>
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <th style={{ padding: '0.85rem 1rem', width: '130px', textAlign: 'center' }}>Продавати на Prom</th>
            <th style={{ padding: '0.85rem 0.5rem', width: '70px', textAlign: 'center' }}>Фото</th>
            <th style={{ padding: '0.85rem 0.75rem', width: '160px' }}>Артикул</th>
            <th style={{ padding: '0.85rem' }}>Назва товару</th>
            <th style={{ padding: '0.85rem', width: '120px' }}>Ціна</th>
            <th style={{ padding: '0.85rem', width: '130px', textAlign: 'center' }}>Склад (Excel)</th>
            <th style={{ padding: '0.85rem', width: '220px' }}>Статус на Prom.ua</th>
          </tr>
        </thead>
        <tbody>
          {products.map(product => renderPromProductRow(product))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      {/* Prom Header */}
      <div className="header">
        <div>
          <h1>🟣 Керування товарами Prom.ua</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Синхронізація наявності та залишків через Prom API</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            className="btn"
            style={{ background: '#6366f1', color: '#fff', boxShadow: '0 1px 3px rgba(99, 102, 241, 0.3)' }}
            onClick={handleRefreshProm}
            disabled={syncingProm || loading || savingProm || !token}
            title="Підтягнути актуальний список товарів, нові артикули та статуси з Prom.ua"
          >
            {syncingProm ? <span className="loader" style={{ width: '16px', height: '16px' }}></span> : '🔄 Оновити з Prom.ua'}
          </button>
          <button
            className="btn"
            style={{ background: '#8b5cf6', color: '#fff', boxShadow: '0 1px 3px rgba(139, 92, 246, 0.3)' }}
            onClick={handlePushStockToProm}
            disabled={syncingProm || loading || savingProm || !token}
            title="Передати поточні залишки зі складу на Prom.ua (переводить товари в 'В наявності' або 'Немає')"
          >
            {syncingProm ? <span className="loader" style={{ width: '16px', height: '16px' }}></span> : '⚡ Передати залишки на Prom'}
          </button>
          <button
            className="btn success"
            onClick={handleSaveProm}
            disabled={savingProm || syncingProm || loading || !token}
            title="Зберегти позначені галочками товари для Prom.ua"
          >
            {savingProm ? <span className="loader" style={{ width: '16px', height: '16px' }}></span> : '💾 Зберегти вибір Prom'}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
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
          style={{ cursor: 'pointer', border: promFilterMode === 'only_on_prom' ? '2px solid #9333ea' : '1px solid var(--border-color)', transition: 'all 0.2s', background: promFilterMode === 'only_on_prom' ? '#faf5ff' : 'transparent' }}
          onClick={() => setPromFilterMode(promFilterMode === 'only_on_prom' ? 'all' : 'only_on_prom')}
          title="Фільтр: товари, які є на Prom.ua, але відсутні у вивантаженні Хорошопу"
        >
          <div className="stat-label">📦 Тільки на Prom.ua</div>
          <div className="stat-value" style={{ color: '#9333ea' }}>{promStats.onlyOnProm}</div>
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

      {/* Controls Bar */}
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
          <option value="all">👁️ Усі товари ({promStats.total})</option>
          <option value="only_on_prom">📦 Тільки на Prom.ua ({promStats.onlyOnProm})</option>
          <option value="no_match">⚠️ Немає збігу артикулу ({promStats.noMatch})</option>
          <option value="out_of_stock_horoshop">⚠️ Немає в наявності на Хорошопі ({promStats.outOfStockHoroshop})</option>
          <option value="enabled">🟣 Увімкнені для Prom ({promStats.enabled})</option>
          <option value="in_stock">🟢 В наявності ({promStats.inStock})</option>
          <option value="out_of_stock">🔴 Немає в наявності ({promStats.outOfStock})</option>
          <option value="disabled">⚪ Вимкнені (Немає в наявн.) ({promStats.disabled})</option>
        </select>

        <select
          className="input-field"
          style={{ width: 'auto', minWidth: '260px', fontSize: '0.95rem', cursor: 'pointer' }}
          value={promCategoryFilter}
          onChange={e => setPromCategoryFilter(e.target.value)}
        >
          <option value="all">📁 Усі категорії ({promCategoryTree.length} груп)</option>
          {promCategoryTree.map(group => (
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

      {/* Quick Bulk Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Знайдено: <strong style={{ color: 'var(--text-main)' }}>{filteredPromCatalog.length}</strong> товарів {!promSearchQuery.trim() && `у ${promGrouped.length} групах`}
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
          {renderPromTable(filteredPromCatalog.slice(0, 200))}
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
            promGrouped.map(group => {
              const { enabled, total } = getPromCategoryStats(group.products);
              const isMainCollapsed = collapsedPromCategories[group.main] !== undefined
                ? collapsedPromCategories[group.main]
                : (promCategoryFilter === 'all' && promFilterMode === 'all');
              const hasMultipleSubs = group.subs.length > 1 || (group.subs[0] && group.subs[0].name !== 'Основні товари' && group.subs[0].name !== group.main);

              return (
                <div key={group.main} className="glass-panel" style={{ marginBottom: '1rem', padding: 0, overflow: 'hidden' }}>
                  {/* Primary Category Header */}
                  <div
                    onClick={() => togglePromCategory(group.main)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem',
                      cursor: 'pointer', borderBottom: isMainCollapsed ? 'none' : '1px solid var(--border-color)',
                      background: isMainCollapsed ? '#ffffff' : 'rgba(139, 92, 246, 0.05)',
                      transition: 'background 0.2s', userSelect: 'none'
                    }}
                  >
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1.15rem' }}>📁</span>
                      <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>{group.main}</span>
                      <span className="badge" style={{ background: enabled > 0 ? '#dcfce7' : '#f3f4f6', color: enabled > 0 ? '#15803d' : '#6b7280', fontSize: '0.85rem', padding: '0.2rem 0.55rem' }}>
                        🟣 {enabled}/{total} для Prom
                      </span>
                      {group.subs.length > 1 && (
                        <span style={{ fontSize: '0.8rem', color: '#6b21a8', background: '#f3e8ff', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                          {group.subs.length} підкатегорій
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem', marginRight: '0.75rem' }} onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn"
                        style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem', background: '#8b5cf6', color: '#ffffff' }}
                        onClick={() => handlePromBulkListToggle(true, group.products)}
                        title="Увімкнути всі товари цієї категорії для Prom"
                      >
                        🟣 Всі ({total})
                      </button>
                      <button
                        type="button"
                        className="btn"
                        style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem', background: '#ffffff', color: '#64748b', border: '1px solid #cbd5e1' }}
                        onClick={() => handlePromBulkListToggle(false, group.products)}
                        title="Вимкнути всі товари цієї категорії з Prom"
                      >
                        ⚪ Вимкнути
                      </button>
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
                      {isMainCollapsed ? '▶' : '▼'}
                    </span>
                  </div>

                  {/* Expanded Main Category Content */}
                  {!isMainCollapsed && (
                    !hasMultipleSubs ? (
                      renderPromTable(group.subs[0] ? group.subs[0].products : group.products)
                    ) : (
                      <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', background: '#fdfcfe' }}>
                        {group.subs.map(sub => {
                          const subStats = getPromCategoryStats(sub.products);
                          const isSubFiltered = promCategoryFilter === `sub:${sub.fullPath}` || promCategoryFilter === sub.fullPath;
                          const isSubCollapsed = isSubFiltered
                            ? false
                            : (collapsedPromSubCategories[sub.fullPath] !== false);

                          return (
                            <div key={sub.fullPath} style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #e9d5ff', overflow: 'hidden' }}>
                              <div
                                onClick={() => togglePromSubCategory(sub.fullPath)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.65rem 1rem',
                                  cursor: 'pointer', background: isSubCollapsed ? '#ffffff' : '#faf5ff',
                                  borderBottom: isSubCollapsed ? 'none' : '1px solid #f3e8ff',
                                  transition: 'background 0.15s', userSelect: 'none'
                                }}
                              >
                                <span style={{ color: '#8b5cf6', fontSize: '0.9rem', fontWeight: 700 }}>↳</span>
                                <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#1e293b' }}>{sub.name}</span>
                                <span className="badge" style={{ background: subStats.enabled > 0 ? '#dcfce7' : '#f3f4f6', color: subStats.enabled > 0 ? '#15803d' : '#6b7280', fontSize: '0.8rem', padding: '0.15rem 0.45rem' }}>
                                  {subStats.enabled}/{subStats.total}
                                </span>
                                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.35rem' }} onClick={e => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    className="btn"
                                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe' }}
                                    onClick={() => handlePromBulkListToggle(true, sub.products)}
                                    title="Увімкнути товари підкатегорії"
                                  >
                                    🟣 Всі
                                  </button>
                                  <button
                                    type="button"
                                    className="btn"
                                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', background: '#ffffff', color: '#64748b', border: '1px solid #e2e8f0' }}
                                    onClick={() => handlePromBulkListToggle(false, sub.products)}
                                    title="Вимкнути товари підкатегорії"
                                  >
                                    ⚪ Зняти
                                  </button>
                                </div>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem', paddingLeft: '0.35rem' }}>
                                  {isSubCollapsed ? '▶' : '▼'}
                                </span>
                              </div>
                              {!isSubCollapsed && renderPromTable(sub.products)}
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
