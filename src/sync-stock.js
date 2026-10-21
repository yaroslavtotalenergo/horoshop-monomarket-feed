const axios = require('axios');
const { parse } = require('csv-parse/sync');
const fs = require('fs');
const path = require('path');
const { notifyError, notifySuccess } = require('./notify');

const DEFAULT_WAREHOUSES = [
  'ридомиль',
  'в.олександівка 1',
  'в.олександівка 2',
  'с.борщагівка',
  'київ1',
  'київ2',
  'київ 1',
  'київ 2',
  'переміщюється з борщагівки до ридомиль'
];

function normalizeStr(s) {
  return String(s || '').toLowerCase().replace(/[\s\-_.,/\\()[\]'"`«»]/g, '');
}

function parseWarehouseNames(raw) {
  if (!raw) return DEFAULT_WAREHOUSES;
  let cleaned = String(raw).trim();
  if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
    try {
      const validJson = cleaned.replace(/'/g, '"');
      const parsed = JSON.parse(validJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(s => String(s).trim().toLowerCase()).filter(Boolean);
      }
    } catch (e) { }
  }

  const list = cleaned
    .split(/[\r\n,]+/)
    .map(s => s.replace(/[\[\]'"`]/g, '').trim().toLowerCase())
    .filter(Boolean);

  return list.length > 0 ? list : DEFAULT_WAREHOUSES;
}

async function main() {
  console.log('🚀 Синхронізація залишків з Google Sheets...');

  // Зберігаємо Telegram облікові дані для наступних кроків workflow (convert, horoshop API)
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    try {
      fs.writeFileSync(path.join(__dirname, '..', '.tg-runtime.json'), JSON.stringify({
        token: process.env.TELEGRAM_BOT_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID
      }), 'utf8');
    } catch (_) { }
  }

  // ── 1. Завантаження конфігурації ──────────────────────────────
  let sheets = [];
  if (process.env.GOOGLE_SHEETS_URLS) {
    sheets = process.env.GOOGLE_SHEETS_URLS
      .split(/[\r\n,]+/)
      .map(s => s.trim())
      .filter(Boolean);
  } else {
    try {
      if (fs.existsSync('src/google-sheets.json')) {
        const localCfg = JSON.parse(fs.readFileSync('src/google-sheets.json', 'utf8'));
        if (Array.isArray(localCfg.sheets)) {
          sheets = localCfg.sheets.map(s => s.trim()).filter(Boolean);
        }
      }
    } catch (e) { }
  }

  const config = { sheets };

  if (!config.sheets || config.sheets.length === 0) {
    const msg = 'Список таблиць порожній (задайте GOOGLE_SHEETS_URLS у GitHub Secrets або src/google-sheets.json)';
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

  let warehouseList = [];
  if (process.env.WAREHOUSE_NAMES) {
    warehouseList = parseWarehouseNames(process.env.WAREHOUSE_NAMES);
  } else if (fs.existsSync('src/warehouses.json')) {
    try {
      const parsed = JSON.parse(fs.readFileSync('src/warehouses.json', 'utf8'));
      const rawList = Array.isArray(parsed) ? parsed : (parsed.warehouses || []);
      warehouseList = parseWarehouseNames(rawList.join(', '));
    } catch { }
  }
  if (warehouseList.length === 0) {
    warehouseList = DEFAULT_WAREHOUSES;
  }

  const keywords = {
    article: ['артикул', 'артікул', 'vendor code', 'vendor_code'],
    warehouses: warehouseList
  };

  let updatedCount = 0;
  const warnings = [];
  let hasAnyFatalError = false;
  const seenInCurrentRun = new Set();

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

      // ── 3c. Пошук стовпчика Артикул та Складів ───────────────────
      let articleIdx = -1;
      let warehouseIndices = [];

      for (let i = 0; i < Math.min(20, rows.length); i++) {
        rows[i].forEach((cell, idx) => {
          const rawVal = cell.trim().toLowerCase();
          const normVal = normalizeStr(cell);

          if (keywords.article.some(a => rawVal === a || normVal === normalizeStr(a))) {
            articleIdx = idx;
          }
          if (keywords.warehouses.some(w => rawVal === w || normVal === normalizeStr(w))) {
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
        continue; // Не обнуляємо залишки, якщо склади в цій вкладці не знайдено!
      } else {
        console.log(`   ✅ Знайдено складів: ${warehouseIndices.length} шт.`);
      }

      // ── 3d. Читання залишків ───────────────────────────────────
      let sheetCount = 0;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const vendorCode = row[articleIdx] ? row[articleIdx].trim() : null;

        if (!vendorCode || keywords.article.some(a => vendorCode.toLowerCase() === a || normalizeStr(vendorCode) === normalizeStr(a))) continue;

        let totalQty = 0;
        for (const wIdx of warehouseIndices) {
          const val = row[wIdx] ? String(row[wIdx]).replace(/\s/g, '').replace(',', '.').trim() : '';
          const qty = parseInt(val, 10);
          if (!isNaN(qty)) {
            totalQty += qty;
          }
        }

        if (!seenInCurrentRun.has(vendorCode)) {
          stockOverrides[vendorCode] = totalQty;
          seenInCurrentRun.add(vendorCode);
        } else {
          // Якщо товар зустрічається в таблиці декілька разів — фіксуємо максимум,
          // щоб порожній дубль з іншої категорії не затер рядок з реальним залишком
          stockOverrides[vendorCode] = Math.max(stockOverrides[vendorCode] || 0, totalQty);
        }
        availabilityOverrides[vendorCode] = stockOverrides[vendorCode] > 0;
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

  // Перевірка на аномальне масове обнулення товарів (сповіщення без зупинки синхронізації)
  const prevPositiveCount = Object.values(previousStock).filter(v => Number(v) > 0).length;
  const newPositiveCount = Object.values(stockOverrides).filter(v => Number(v) > 0).length;
  const zeroedItems = detectedChanges.filter(c => c.type === 'became_zero');
  const zeroedCount = zeroedItems.length;

  if (prevPositiveCount >= 10 && (zeroedCount >= 30 || (zeroedCount >= 15 && zeroedCount >= prevPositiveCount * 0.35))) {
    console.warn(`⚠️ Увага: аномальне обнулення ${zeroedCount} товарів! Надсилаємо сповіщення в Telegram...`);
    const sampleProducts = zeroedItems.slice(0, 5).map(item => `• ${item.name} (арт. <code>${item.vendorCode}</code>)`).join('\n');
    const alertMsg = `⚠️ <b>Увага: аномальне обнулення залишків!</b>\n\n` +
      `📉 Раптово обнулилося: <b>${zeroedCount} товарів</b>\n` +
      `📦 Було в наявності: <b>${prevPositiveCount}</b> → Залишилось: <b>${newPositiveCount}</b>\n\n` +
      `📋 <b>Приклади товарів, які стали 0:</b>\n${sampleProducts}` +
      (zeroedCount > 5 ? `\n<i>...та ще ${zeroedCount - 5} товарів</i>\n\n` : '\n\n') +
      `ℹ️ <i>Синхронізацію не призупинено, зміни застосовано. Якщо це не планова зміна, терміново перевірте Google Таблиці (колонки залишків/складів)!</i>`;

    const { sendTelegram } = require('./notify');
    await sendTelegram(alertMsg);
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
    const promResult = await syncProm();
    if (promResult && promResult.errors > 0) {
      const failed = promResult.failedDetails || [];
      const detailsList = failed.slice(0, 10).map((f, i) => {
        return `${i + 1}. [ID ${f.id}] Арт: ${f.sku}\n   Назва: ${f.name}\n   Помилка: ${f.reason}`;
      }).join('\n\n');

      await notifyError(
        `Prom.ua відхилив ${promResult.errors} товарів`,
        detailsList || `Не вдалося оновити ${promResult.errors} товарів через помилки Prom API.`
      );
    }
  } catch (err) {
    console.warn('⚠️ Оновлення Prom.ua помилка:', err.message);
    await notifyError('Збій синхронізації з Prom.ua API', err.message);
  }

  // ── 7. Перевірка запиту на тестове сповіщення в Telegram ────────
  const flagPath = path.join(__dirname, 'test-telegram.flag');
  if (fs.existsSync(flagPath) || process.env.TEST_TELEGRAM === '1' || process.argv.includes('--test-telegram')) {
    console.log('📨 Виявлено запит на тестове сповіщення! Надсилаємо в Telegram...');
    const { sendTelegram } = require('./notify');
    await sendTelegram(
      `🧪 <b>Тестове сповіщення від бота CRM PRO</b>\n\n` +
      `✅ Зв'язок з Telegram успішно перевірено!\n` +
      `📦 Товарів опрацьовано: <b>${updatedCount}</b>\n` +
      `⏰ Час: <b>${new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' })}</b>\n` +
      `🚀 Система активна і готова до автоматичної синхронізації.`
    );
    if (fs.existsSync(flagPath)) {
      try {
        fs.unlinkSync(flagPath);
        const { execSync } = require('child_process');
        execSync('git rm -f src/test-telegram.flag 2>/dev/null || true');
        console.log('🧹 Прапорець тестового сповіщення видалено.');
      } catch (cleanErr) {
        console.warn('⚠️ Не вдалося видалити прапорець з git:', cleanErr.message);
      }
    }
  }

  // ── 8. Telegram-сповіщення тільки при помилках ───────────────
  // Успішне стандартне оновлення — без сповіщення, щоб уникнути спаму
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
