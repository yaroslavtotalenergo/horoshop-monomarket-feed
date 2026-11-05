import React, { useState, useMemo } from 'react';
import { isHoroshopOutOfStock, buildHierarchicalGroups, matchesCategoryFilter, FEED_URLS } from '../utils/helpers';

export default function HoroshopTab({
  catalog = [],
  stockOverrides = {},
  names = {},
  horoshopPresence = {},
  setHoroshopPresence,
  horoshopInstallments = {},
  setHoroshopInstallments,
  categoryTree = [],
  token,
  api,
  loading,
  showToast,
  copyToClipboard,
  horoshopSearchQuery,
  setHoroshopSearchQuery,
  horoshopFilterMode,
  setHoroshopFilterMode
}) {
  const [savingHoroshop, setSavingHoroshop] = useState(false);
  const [syncingHoroshop, setSyncingHoroshop] = useState(false);
  const [horoshopCategoryFilter, setHoroshopCategoryFilter] = useState('all');
  const [collapsedHoroshopCategories, setCollapsedHoroshopCategories] = useState({});
  const [collapsedHoroshopSubCategories, setCollapsedHoroshopSubCategories] = useState({});

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
    const installmentsMode = horoshopInstallments[code] || 'auto';

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
  }, [catalog, horoshopPresence, horoshopInstallments, stockOverrides]);

  const filteredHoroshopCatalog = useMemo(() => {
    const q = horoshopSearchQuery.toLowerCase().trim();

    return catalog.filter(p => {
      const code = p.vendorCode ? String(p.vendorCode).trim() : '';
      const name = p.name || '';
      if (q) {
        const matches = name.toLowerCase().includes(q) || code.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (horoshopCategoryFilter !== 'all' && !matchesCategoryFilter(p.category, horoshopCategoryFilter)) {
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
  }, [catalog, horoshopSearchQuery, horoshopCategoryFilter, horoshopFilterMode, horoshopPresence, horoshopInstallments, stockOverrides]);

  const horoshopGrouped = useMemo(() => {
    return buildHierarchicalGroups(filteredHoroshopCatalog);
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
      } catch {
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

  const toggleHoroshopCategory = (cat) => setCollapsedHoroshopCategories(prev => {
    const isCurrentlyCollapsed = prev[cat] !== false;
    return { ...prev, [cat]: !isCurrentlyCollapsed };
  });

  const toggleHoroshopSubCategory = (subPath) => setCollapsedHoroshopSubCategories(prev => {
    const isCurrentlyCollapsed = prev[subPath] !== false;
    return { ...prev, [subPath]: !isCurrentlyCollapsed };
  });

  const expandAllHoroshop = () => {
    const nextMain = {};
    const nextSub = {};
    horoshopGrouped.forEach(g => {
      nextMain[g.main] = false;
      g.subs.forEach(s => { nextSub[s.fullPath] = false; });
    });
    setCollapsedHoroshopCategories(nextMain);
    setCollapsedHoroshopSubCategories(nextSub);
  };

  const collapseAllHoroshop = () => {
    const nextMain = {};
    horoshopGrouped.forEach(g => { nextMain[g.main] = true; });
    setCollapsedHoroshopCategories(nextMain);
    setCollapsedHoroshopSubCategories({});
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
        {/* 1. Наявність на Хорошоп */}
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

        {/* 2. Оплата частинами (ОЧ) */}
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

            {presenceMode === 'off' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: '#f3f4f6', color: '#9ca3af', fontSize: '0.75rem' }}>
                🚫 ОЧ вимкнено (товар приховано)
              </span>
            ) : installmentsMode === 'off' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: '#fee2e2', color: '#b91c1c', fontSize: '0.75rem', fontWeight: 600 }}>
                🔴 Заборона ОЧ
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

  const renderHoroshopTable = (products) => (
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
  );

  return (
    <div>
      {/* Header */}
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

      {/* Stats Grid */}
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
          style={{ cursor: 'pointer', border: horoshopFilterMode === 'presence_out_of_stock' ? '2px solid var(--text-muted)' : '1px solid var(--border-color)', transition: 'all 0.2s', background: horoshopFilterMode === 'presence_out_of_stock' ? '#f9fafb' : 'transparent' }}
          onClick={() => setHoroshopFilterMode(horoshopFilterMode === 'presence_out_of_stock' ? 'all' : 'presence_out_of_stock')}
          title="Фільтр: Немає в наявності"
        >
          <div className="stat-label">⚪ Немає в наявності</div>
          <div className="stat-value" style={{ color: 'var(--text-muted)' }}>{horoshopStats.outOfStock}</div>
        </div>
        <div
          className="stat-card"
          style={{ cursor: 'pointer', border: horoshopFilterMode === 'presence_off' ? '2px solid var(--danger)' : '1px solid var(--border-color)', transition: 'all 0.2s', background: horoshopFilterMode === 'presence_off' ? '#fef2f2' : 'transparent' }}
          onClick={() => setHoroshopFilterMode(horoshopFilterMode === 'presence_off' ? 'all' : 'presence_off')}
          title="Фільтр: Примусово вимкнено (Немає)"
        >
          <div className="stat-label">🔴 Примусово "Немає"</div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>{horoshopStats.forcedOutOfStock}</div>
        </div>
        <div
          className="stat-card"
          style={{ cursor: 'pointer', border: horoshopFilterMode === 'installments_active' ? '2px solid #8b5cf6' : '1px solid var(--border-color)', transition: 'all 0.2s', background: horoshopFilterMode === 'installments_active' ? '#f5f3ff' : 'transparent' }}
          onClick={() => setHoroshopFilterMode(horoshopFilterMode === 'installments_active' ? 'all' : 'installments_active')}
          title="Фільтр: Оплата частинами активна"
        >
          <div className="stat-label">💳 Оплата частинами (ОЧ)</div>
          <div className="stat-value" style={{ color: '#8b5cf6' }}>{horoshopStats.active}</div>
        </div>
        <div
          className="stat-card"
          style={{ cursor: 'pointer', border: horoshopFilterMode === 'installments_disabled' ? '2px solid var(--danger)' : '1px solid var(--border-color)', transition: 'all 0.2s', background: horoshopFilterMode === 'installments_disabled' ? '#fef2f2' : 'transparent' }}
          onClick={() => setHoroshopFilterMode(horoshopFilterMode === 'installments_disabled' ? 'all' : 'installments_disabled')}
          title="Фільтр: Заборона ОЧ"
        >
          <div className="stat-label">🚫 Заборона ОЧ</div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>{horoshopStats.disabled}</div>
        </div>
      </div>

      {/* Main panel */}
      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
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
            <option value="installments_disabled">🔴 Заборона ОЧ ({horoshopStats.disabled})</option>
          </select>

          <select
            className="input-field"
            style={{ width: 'auto', minWidth: '260px', fontSize: '0.95rem', cursor: 'pointer' }}
            value={horoshopCategoryFilter}
            onChange={e => setHoroshopCategoryFilter(e.target.value)}
          >
            <option value="all">📁 Всі категорії ({categoryTree.length} груп)</option>
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

          <button
            className="btn"
            style={{ fontSize: '0.85rem', padding: '0.55rem 0.85rem', background: '#f8fafc', color: '#4360a0', border: '1px solid #cbd5e1', whiteSpace: 'nowrap' }}
            onClick={() => copyToClipboard(FEED_URLS.horoshop)}
            title="Копіювати URL XML-файлу для імпорту ОЧ в Хорошоп"
          >
            📋 XML фід ОЧ
          </button>
        </div>

        {/* Bulk actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Знайдено: <strong>{filteredHoroshopCatalog.length}</strong> товарів {!horoshopSearchQuery.trim() && `у ${horoshopGrouped.length} групах`}
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

        {/* Products: Flat Table on Search, Accordion on Categories */}
        {horoshopSearchQuery.trim() ? (
          <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
            {renderHoroshopTable(filteredHoroshopCatalog.slice(0, 200))}
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
              horoshopGrouped.map(group => {
                const { inStock, active, total } = getHoroshopCategoryStats(group.products);
                const isMainCollapsed = collapsedHoroshopCategories[group.main] !== undefined
                  ? collapsedHoroshopCategories[group.main]
                  : (horoshopCategoryFilter === 'all' && horoshopFilterMode === 'all');
                const hasMultipleSubs = group.subs.length > 1 || (group.subs[0] && group.subs[0].name !== 'Основні товари' && group.subs[0].name !== group.main);

                return (
                  <div key={group.main} className="glass-panel" style={{ marginBottom: '1rem', padding: 0, overflow: 'hidden' }}>
                    {/* Primary Category Header */}
                    <div
                      onClick={() => toggleHoroshopCategory(group.main)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem',
                        cursor: 'pointer', borderBottom: isMainCollapsed ? 'none' : '1px solid var(--border-color)',
                        background: isMainCollapsed ? '#ffffff' : 'rgba(67, 96, 160, 0.06)',
                        transition: 'background 0.2s', userSelect: 'none'
                      }}
                    >
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '1.15rem' }}>📁</span>
                        <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>{group.main}</span>
                        <span className="badge" style={{ background: inStock > 0 ? '#dcfce7' : '#f3f4f6', color: inStock > 0 ? '#166534' : '#6b7280', fontSize: '0.85rem', padding: '0.2rem 0.55rem' }}>
                          В наявності: {inStock}/{total}
                        </span>
                        <span className="badge" style={{ background: active > 0 ? '#f3e8ff' : '#f3f4f6', color: active > 0 ? '#6b21a8' : '#6b7280', fontSize: '0.85rem', padding: '0.2rem 0.55rem' }}>
                          ОЧ: {active}/{total}
                        </span>
                        {group.subs.length > 1 && (
                          <span style={{ fontSize: '0.8rem', color: '#4360a0', background: '#eef2f9', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                            {group.subs.length} підкатегорій
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem', marginRight: '0.75rem' }} onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }}
                          onClick={() => handleBulkPresenceMode('off', group.products)}
                          title="Поставити 'Немає в наявності' для всієї категорії"
                        >
                          🔴 Немає всі ({total})
                        </button>
                        <button
                          type="button"
                          className="btn"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}
                          onClick={() => handleBulkPresenceMode('auto', group.products)}
                          title="Поставити 'Авто' за складом для всієї категорії"
                        >
                          ⚡ Авто всі
                        </button>
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
                        {isMainCollapsed ? '▶' : '▼'}
                      </span>
                    </div>

                    {/* Expanded Main Category Content */}
                    {!isMainCollapsed && (
                      !hasMultipleSubs ? (
                        renderHoroshopTable(group.subs[0] ? group.subs[0].products : group.products)
                      ) : (
                        <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', background: '#f6f8fb' }}>
                          {group.subs.map(sub => {
                            const subStats = getHoroshopCategoryStats(sub.products);
                            const isSubFiltered = horoshopCategoryFilter === `sub:${sub.fullPath}` || horoshopCategoryFilter === sub.fullPath;
                            const isSubCollapsed = isSubFiltered
                              ? false
                              : (collapsedHoroshopSubCategories[sub.fullPath] !== false);

                            return (
                              <div key={sub.fullPath} style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #cbd7ee', overflow: 'hidden' }}>
                                <div
                                  onClick={() => toggleHoroshopSubCategory(sub.fullPath)}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.65rem 1rem',
                                    cursor: 'pointer', background: isSubCollapsed ? '#ffffff' : '#f1f4f9',
                                    borderBottom: isSubCollapsed ? 'none' : '1px solid #cbd7ee',
                                    transition: 'background 0.15s', userSelect: 'none'
                                  }}
                                >
                                  <span style={{ color: '#4360a0', fontSize: '0.9rem', fontWeight: 700 }}>↳</span>
                                  <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#1e293b' }}>{sub.name}</span>
                                  <span className="badge" style={{ background: subStats.inStock > 0 ? '#dcfce7' : '#f3f4f6', color: subStats.inStock > 0 ? '#166534' : '#6b7280', fontSize: '0.8rem', padding: '0.15rem 0.45rem' }}>
                                    Наявність: {subStats.inStock}/{subStats.total}
                                  </span>
                                  <span className="badge" style={{ background: subStats.active > 0 ? '#f3e8ff' : '#f3f4f6', color: subStats.active > 0 ? '#6b21a8' : '#6b7280', fontSize: '0.8rem', padding: '0.15rem 0.45rem' }}>
                                    ОЧ: {subStats.active}/{subStats.total}
                                  </span>
                                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.35rem' }} onClick={e => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      className="btn"
                                      style={{ fontSize: '0.72rem', padding: '0.18rem 0.45rem', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }}
                                      onClick={() => handleBulkPresenceMode('off', sub.products)}
                                      title="Поставити 'Немає' для підкатегорії"
                                    >
                                      🔴 Немає
                                    </button>
                                    <button
                                      type="button"
                                      className="btn"
                                      style={{ fontSize: '0.72rem', padding: '0.18rem 0.45rem', background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1' }}
                                      onClick={() => handleBulkPresenceMode('auto', sub.products)}
                                      title="Поставити 'Авто' для підкатегорії"
                                    >
                                      ⚡ Авто
                                    </button>
                                  </div>
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem', paddingLeft: '0.35rem' }}>
                                    {isSubCollapsed ? '▶' : '▼'}
                                  </span>
                                </div>
                                {!isSubCollapsed && renderHoroshopTable(sub.products)}
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
    </div>
  );
}
