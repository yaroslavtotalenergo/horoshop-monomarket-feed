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

  let availabilityOverrides = {};
  try { availabilityOverrides = JSON.parse(fs.readFileSync('src/availability.json', 'utf8')); } catch (e) { }

  const keywords = {
    article: ['артикул', 'артікул', 'vendor code', 'vendor_code'],
    warehouses: ['ридомиль', 'в.олександівка 1', 'в.олександівка 2', 'с.борщагівка', 'київ1', 'київ2', 'київ 1', 'київ 2']
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

  // ── 4. Збереження результатів ─────────────────────────────────
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
    execSync('git add src/stock.json src/availability.json');
    console.log('✅ Файли залишків додані до git commit.');
  } catch (err) {
    console.error('⚠️ Не вдалося додати файли до git:', err.message);
  }

  console.log(`✅ Синхронізацію завершено! Оновлено/перевірено ${updatedCount} товарів.`);

  // ── 5. Telegram-сповіщення про результат ─────────────────────
  if (!hasAnyFatalError) {
    await notifySuccess(updatedCount, warnings);
  }
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
