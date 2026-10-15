const axios = require('axios');
const { parse } = require('csv-parse/sync');
const fs = require('fs');
const { notifyError, notifySuccess } = require('./notify');

async function main() {
  console.log('🚀 Синхронізація залишків з Google Sheets...');

  // ── 1. Завантаження конфігурації ──────────────────────────────
  let config = { sheets: [] };
  try {
    config = JSON.parse(fs.readFileSync('src/google-sheets.json', 'utf8'));
  } catch (e) {
    const msg = 'Файл src/google-sheets.json не знайдено або пошкоджено';
    console.error('❌ ' + msg);
    await notifyError('Конфігурацію таблиць не знайдено', msg);
    return;
  }

  if (!config.sheets || config.sheets.length === 0) {
    const msg = 'Список таблиць у google-sheets.json порожній';
    console.warn('⚠️ ' + msg);
    await notifyError('Таблиці не налаштовані', msg);
    return;
  }

  // ── 2. Завантаження поточних залишків ──────────────────────────
  let stockOverrides = {};
  try { stockOverrides = JSON.parse(fs.readFileSync('src/stock.json', 'utf8')); } catch (e) { }
  const previousStock = { ...stockOverrides };

  let availabilityOverrides = {};
  try { availabilityOverrides = JSON.parse(fs.readFileSync('src/availability.json', 'utf8')); } catch (e) { }

  let names = {};
  try { names = JSON.parse(fs.readFileSync('src/names.json', 'utf8')); } catch (e) { }

  let catalogMap = {};
  try {
    const rawCatalog = JSON.parse(fs.readFileSync('feeds/catalog.json', 'utf8'));
    const catList = Array.isArray(rawCatalog) ? rawCatalog : (rawCatalog.data || []);
    catList.forEach(p => { if (p.vendorCode) catalogMap[p.vendorCode] = p; });
  } catch (e) { }

  let stockChanges = [];
  try {
    stockChanges = JSON.parse(fs.readFileSync('src/stock-changes.json', 'utf8'));
    if (!Array.isArray(stockChanges)) stockChanges = [];
  } catch (e) {
    stockChanges = [];
  }

  const keywords = {
    article: ['артикул', 'артікул', 'vendor code', 'vendor_code'],
    warehouses: ['ридомиль', 'в.олександівка 1', 'в.олександівка 2', 'с.борщагівка', 'київ1', 'київ2', 'київ 1', 'київ 2', 'переміщюється з борщагівки до ридомиль']
  };

  let updatedCount = 0;
  const warnings = [];
  let hasAnyFatalError = false;

  // ── 3. Обробка кожної таблиці ──────────────────────────────────
  for (const sheetUrl of config.sheets) {
    if (!sheetUrl) continue;

    let exportUrl = sheetUrl;
    let gid = '';
    const gidMatch = exportUrl.match(/gid=([0-9]+)/);
    if (gidMatch) gid = `&gid=${gidMatch[1]}`;

    if (exportUrl.includes('/edit')) {
      exportUrl = exportUrl.replace(/\/edit.*/, `/export?format=csv${gid}`);
    } else if (exportUrl.includes('/export') && !exportUrl.includes('gid=') && gid) {
      exportUrl += gid;
    }

    const sheetLabel = gid ? `вкладка gid=${gidMatch[1]}` : 'основна вкладка';
    console.log(`📥 Завантаження (${sheetLabel}): ${exportUrl}`);

    try {
      // ── 3a. HTTP запит до Google Sheets ───────────────────────
      let res;
      try {
        res = await axios.get(exportUrl, { timeout: 30000 });
      } catch (e) {
        const errMsg = e.response
          ? `HTTP ${e.response.status}: ${e.response.statusText}`
          : e.message;
        console.error(`❌ Не вдалось завантажити таблицю (${sheetLabel}): ${errMsg}`);
        await notifyError(
          `Не вдалось завантажити таблицю (${sheetLabel})`,
          `URL: ${exportUrl}\nПомилка: ${errMsg}\n\nПеревірте, чи таблиця відкрита для доступу.`
        );
        hasAnyFatalError = true;
        continue;
      }

      const csvData = res.data;
      if (!csvData || csvData.trim().length === 0) {
        const msg = `Отримано порожній файл з таблиці (${sheetLabel})`;
        console.warn('⚠️ ' + msg);
        warnings.push(msg);
        continue;
      }

      // ── 3b. Парсинг CSV ───────────────────────────────────────
      let rows;
      try {
        rows = parse(csvData, {
          skip_empty_lines: true,
          relax_column_count: true
        });
      } catch (e) {
        const msg = `Не вдалось обробити CSV з таблиці (${sheetLabel}): ${e.message}`;
        console.error('❌ ' + msg);
        await notifyError(`Помилка парсингу CSV (${sheetLabel})`, msg);
        hasAnyFatalError = true;
        continue;
      }

      // ── 3c. Пошук стовпчика Артикул ───────────────────────────
      let articleIdx = -1;
      let warehouseIndices = [];

      for (let i = 0; i < Math.min(20, rows.length); i++) {
        rows[i].forEach((cell, idx) => {
          const val = cell.trim().toLowerCase();
          if (keywords.article.includes(val)) articleIdx = idx;
          if (keywords.warehouses.includes(val)) {
            if (!warehouseIndices.includes(idx)) warehouseIndices.push(idx);
          }
        });
      }

      if (articleIdx === -1) {
        const msg = `Колонку "Артикул" не знайдено в перших 20 рядках (${sheetLabel}).\nПереконайтесь, що у таблиці є стовпчик з назвою "Артикул".`;
        console.warn('⚠️ ' + msg);
        await notifyError(`Не знайдено стовпчик "Артикул" (${sheetLabel})`, msg);
        hasAnyFatalError = true;
        continue;
      }

      if (warehouseIndices.length === 0) {
        const warehouseNames = keywords.warehouses.join(', ');
        const msg = `Жодного складу не знайдено в таблиці (${sheetLabel}).\nОчікувані назви стовпчиків: ${warehouseNames}`;
        console.warn('⚠️ ' + msg);
        warnings.push(`(${sheetLabel}): стовпчики складів не знайдено`);
        await notifyError(`Не знайдено стовпчики складів (${sheetLabel})`, msg);
      } else {
        console.log(`   ✅ Знайдено складів: ${warehouseIndices.length} шт.`);
      }

      // ── 3d. Читання залишків ───────────────────────────────────
      let sheetCount = 0;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const vendorCode = row[articleIdx] ? row[articleIdx].trim() : null;

        if (!vendorCode || keywords.article.includes(vendorCode.toLowerCase())) continue;

        let totalQty = 0;
        for (const wIdx of warehouseIndices) {
          const val = row[wIdx] ? String(row[wIdx]).replace(/\s/g, '').replace(',', '.').trim() : '';
          const qty = parseInt(val, 10);
          if (!isNaN(qty)) {
            totalQty += qty;
          }
        }

        stockOverrides[vendorCode] = totalQty;
        availabilityOverrides[vendorCode] = totalQty > 0;
        updatedCount++;
        sheetCount++;
      }

      console.log(`   ✅ Оброблено ${sheetCount} товарів з (${sheetLabel})`);

    } catch (e) {
      const msg = `Непередбачена помилка при обробці (${sheetLabel}): ${e.message}`;
      console.error('❌ ' + msg);
      await notifyError(`Непередбачена помилка (${sheetLabel})`, msg);
      hasAnyFatalError = true;
    }
  }

  // ── 4. Фіксація змін залишків (Stock Changes Log) ──────────────
  const detectedChanges = [];
  const nowIso = new Date().toISOString();

  for (const [code, newQty] of Object.entries(stockOverrides)) {
    const oldQty = previousStock[code];
    if (oldQty !== undefined && oldQty !== newQty) {
      let type = 'changed';
      if (oldQty > 0 && newQty === 0) type = 'became_zero';
      else if (oldQty === 0 && newQty > 0) type = 'became_available';

      const prod = catalogMap[code] || {};
      detectedChanges.push({
        id: `${code}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        timestamp: nowIso,
        vendorCode: code,
        name: names[code] || prod.name || code,
        category: prod.category || '',
        price: prod.price || '',
        oldQty,
        newQty,
        diff: newQty - oldQty,
        type
      });
    }
  }

  if (detectedChanges.length > 0) {
    console.log(`🔔 Зафіксовано ${detectedChanges.length} змін залишків у таблиці Excel!`);
    stockChanges = [...detectedChanges, ...stockChanges].slice(0, 500);
    try {
      fs.writeFileSync('src/stock-changes.json', JSON.stringify(stockChanges, null, 2), 'utf8');
      console.log('✅ Оновлено журнал змін: src/stock-changes.json');
    } catch (e) {
      console.error('⚠️ Помилка запису stock-changes.json:', e.message);
    }
  }

  // ── 5. Збереження результатів ─────────────────────────────────
  try {
    fs.writeFileSync('src/stock.json', JSON.stringify(stockOverrides, null, 2), 'utf8');
    fs.writeFileSync('src/availability.json', JSON.stringify(availabilityOverrides, null, 2), 'utf8');
  } catch (e) {
    const msg = `Не вдалось зберегти файли залишків: ${e.message}`;
    console.error('❌ ' + msg);
    await notifyError('Помилка збереження залишків', msg);
    return;
  }

  try {
    const { execSync } = require('child_process');
    execSync('git add src/stock.json src/availability.json src/stock-changes.json');
    console.log('✅ Файли залишків додані до git commit.');
  } catch (err) {
    console.error('⚠️ Не вдалося додати файли до git:', err.message);
  }

  console.log(`✅ Синхронізацію залишків завершено! Оновлено/перевірено ${updatedCount} товарів.`);

  // ── 6. Синхронізація з Prom.ua ───────────────────────────────
  try {
    const syncProm = require('./sync-prom');
    console.log('🔄 Запуск оновлення наявності та залишків на Prom.ua...');
    await syncProm();
  } catch (err) {
    console.warn('⚠️ Оновлення Prom.ua пропущено або помилка:', err.message);
  }

  // ── 5. Telegram-сповіщення тільки при помилках ───────────────
  // Успішне оновлення — без сповіщення
}

module.exports = main;

if (require.main === module) {
  main().catch(async (e) => {
    console.error('💥 Критична помилка:', e.message);
    const { notifyError } = require('./notify');
    await notifyError('Критична помилка синхронізації', e.message);
    process.exit(1);
  });
}
