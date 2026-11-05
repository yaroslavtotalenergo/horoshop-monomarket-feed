import React, { useState, useMemo } from 'react';

export default function StockLogModal({
  show,
  onClose,
  stockChanges = [],
  stockOverrides = {},
  onClearStockLog,
  navigateToHoroshop,
  navigateToProm,
  navigateToMono,
  copyToClipboard
}) {
  const [stockLogSearch, setStockLogSearch] = useState('');
  const [stockLogFilter, setStockLogFilter] = useState('all'); // 'all', 'became_zero', 'became_available', 'changed'

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

  if (!show) return null;

  const becameZeroCount = stockChanges.filter(c => c.type === 'became_zero' || c.newQty === 0).length;
  const becameAvailCount = stockChanges.filter(c => c.type === 'became_available' || (c.oldQty === 0 && c.newQty > 0)).length;
  const otherCount = stockChanges.filter(c => c.type === 'changed' || (c.oldQty > 0 && c.newQty > 0)).length;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div 
        className="glass-panel modal" 
        onClick={e => e.stopPropagation()} 
        style={{ maxWidth: '980px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '1.5rem' }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.35rem' }}>
              <span>📋</span> Журнал останніх змін залишків у таблиці Excel
            </h2>
            <p style={{ margin: '0.35rem 0 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Фіксація оновлень кількості на складі з Google Таблиць. Швидкий перехід до товару на Хорошопі для оперативного редагування наявності.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.35rem', color: 'var(--text-muted)', padding: '0.2rem' }}
            title="Закрити"
          >
            ✕
          </button>
        </div>

        {/* Quick KPI Stat Chips */}
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

          {stockChanges.length > 0 && onClearStockLog && (
            <button
              className="btn"
              style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', fontSize: '0.8rem', padding: '0.5rem 0.85rem' }}
              onClick={onClearStockLog}
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
            onClick={onClose}
          >
            Зрозуміло
          </button>
        </div>
      </div>
    </div>
  );
}

