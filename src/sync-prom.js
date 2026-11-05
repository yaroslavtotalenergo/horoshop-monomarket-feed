// ==========================================
// Синхронізація залишків та наявності з Prom.ua
// ==========================================
// Логіка:
// 1. Отримує список товарів з Prom.ua (за артикулом / SKU).
// 2. Читає залишки зі src/stock.json (синхронізовані з Excel / Google Sheets).
// 3. Читає список увімкнених товарів зі src/prom-whitelist.json.
// 4. Оновлює статуси:
//    - Якщо товар увімкнено і залишок > 0: status="on_display", presence="available", in_stock=true, quantity_in_stock=залишок
//    - Якщо товар увімкнено і залишок == 0: status="on_display", presence="not_available", in_stock=false, quantity_in_stock=0
//    - Якщо товар вимкнено (наприклад, запобіжники): status="not_on_display", presence="not_available", in_stock=false, quantity_in_stock=0
// ==========================================

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const isDryRun = process.argv.includes('--dry-run');

// Перевірка дозволених брендів для Prom: Victron Energy, Sunlight, Sacred Sun
function isAllowedPromBrand(product) {
  if (!product) return false;

  const vendorCode = String(product.vendorCode || product.sku || '').trim();
  const name = String(product.name || '').toLowerCase();
  const desc = String(product.description || '').toLowerCase();
  const cat = String(product.category || '').toLowerCase();
  const fullText = `${name} ${desc} ${cat} ${vendorCode.toLowerCase()}`;

  // 1. Victron Energy
  if (fullText.includes('victron')) return true;
  if (/^(BPC|ORI|PMR|BPP|SPM|SCA|CIP|ASS|VEC|BAT|PIN|SCC|CYR|SHU|DMC|MSP|BMP|REC|REL|CSE|BAM|CDP|SBS|VE\.|MPP|QUA|PMP|TMS|BBS|BOX|CAL|COP|COS|DIP|ECE|GRI|INP|ISO|OUT|PAN|PLA|PLU|POT|POW|RPR|SDR|SKY|SPA|STR|TEM|VE48|ADA|ARG|BBA|BCD|BMS|BPA|BPR|CCH|CEP|CIN|CMP|CTR|EVC|FB|GDI|ITR|LV|LYN|PCH|PMC|PPP|PSC|PYLP|PYLU|RCD|SDFI|SDRP|SDTG|SHP|SIN|SKI|SPP|STG|SUNC|TQS|VBB|VBS|VPN)[0-9]/i.test(vendorCode)) {
    return true;
  }

  // 2. Sunlight
  if (fullText.includes('sunlight') || /^SUNP/i.test(vendorCode)) return true;

  // 3. Sacred Sun (including 'sucred' typo)
  if (/s[au]cred\s*sun/i.test(fullText) || fullText.includes('sacred') || fullText.includes('sucred')) return true;
  if (/^(SCIFP|SLSIFP|SSIF|SLS)/i.test(vendorCode)) return true;

  return false;
}

async function syncProm() {
  console.log(`🚀 Початок синхронізації з Prom.ua${isDryRun ? ' [РЕЖИМ ТЕСТУ / DRY-RUN]' : ''}...`);

  // 1. Токен авторизації
  let token = process.env.PROM_API_TOKEN;
  if (!token && fs.existsSync(path.join(__dirname, 'prom-config.json'))) {
    try {
      const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'prom-config.json'), 'utf8'));
      token = cfg.token;
    } catch (e) {
      console.warn('⚠️ Не вдалось прочитати src/prom-config.json:', e.message);
    }
  }

  if (!token) {
    throw new Error('❌ Не вказано токен Prom.ua! Задайте змінну оточення PROM_API_TOKEN або файл src/prom-config.json');
  }

  const client = axios.create({
    baseURL: 'https://my.prom.ua/api/v1',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    timeout: 30000
  });

  // 2. Завантаження локальних даних
  let stockOverrides = {};
  try {
    stockOverrides = JSON.parse(fs.readFileSync(path.join(__dirname, 'stock.json'), 'utf8'));
  } catch (e) {
    console.warn('⚠️ src/stock.json не знайдено, вважаємо всі залишки 0');
  }

  let promWhitelist = [];
  try {
    promWhitelist = JSON.parse(fs.readFileSync(path.join(__dirname, 'prom-whitelist.json'), 'utf8'));
  } catch (e) {
    console.warn('⚠️ src/prom-whitelist.json не знайдено, усі товари будуть вважатись увімкненими');
  }
  const whitelistSet = new Set(promWhitelist.map(s => String(s).trim()));





  // 3. Завантаження всіх товарів з Prom.ua
  console.log('📥 Завантажуємо список товарів з Prom.ua...');
  let promProducts = [];
  let lastId = null;

  while (true) {
    const url = '/products/list?limit=100' + (lastId ? `&last_id=${lastId}` : '');
    const res = await client.get(url);
    const items = res.data.products || [];
    if (items.length === 0) break;
    promProducts.push(...items);
    lastId = items[items.length - 1].id;
    if (items.length < 100) break;
  }

  console.log(`✅ Отримано з Prom.ua: ${promProducts.length} товарів.`);

  // Збереження списку існуючих на Prom артикулів дозволених брендів (Victron Energy, Sunlight, Sacred Sun) для адмінки
  try {
    const allowedProducts = promProducts.filter(p => p.sku && isAllowedPromBrand({ vendorCode: p.sku, name: p.name }));
    const allSkus = Array.from(new Set(allowedProducts.map(p => String(p.sku).trim())));
    const skuMap = {};
    for (const p of allowedProducts) {
      const s = String(p.sku).trim();
      skuMap[s] = {
        id: p.id,
        name: p.name || '',
        main_image: p.main_image || null,
        status: p.status,
        presence: p.presence,
        presenceTitle: p.presence_title || (p.presence === 'available' ? 'В наявності' : 'Немає в наявності'),
        price: p.price,
        quantity: p.quantity_in_stock
      };
    }
    const dataToSave = {
      updatedAt: new Date().toISOString(),
      total: allSkus.length,
      skus: allSkus,
      items: skuMap
    };
    fs.writeFileSync(path.join(__dirname, 'prom-skus.json'), JSON.stringify(dataToSave, null, 2), 'utf8');
    try {
      const { execSync } = require('child_process');
      execSync('git add src/prom-skus.json');
    } catch (_) { }
  } catch (e) {
    console.warn('⚠️ Не вдалося зберегти src/prom-skus.json:', e.message);
  }

  // 4. Аналіз та формування оновлень
  const updates = [];
  let enabledInStockCount = 0;
  let enabledOutOfStockCount = 0;
  let disabledCount = 0;
  let skippedNoSku = 0;
  let skippedOtherBrand = 0;

  for (const p of promProducts) {
    const sku = p.sku ? String(p.sku).trim() : null;
    if (!sku) {
      skippedNoSku++;
      continue;
    }

    // Синхронізуємо тільки дозволені бренди: Victron Energy, Sunlight, Sacred Sun
    if (!isAllowedPromBrand({ vendorCode: sku, name: p.name })) {
      skippedOtherBrand++;
      continue;
    }

    // Чи увімкнено товар для Prom?
    // Якщо список promWhitelist існує — перевіряємо входження.
    // Якщо список порожній (не налаштовано) — за замовчуванням увімкнено.
    const isEnabled = promWhitelist.length === 0 || whitelistSet.has(sku);

    let stockQty = 0;
    if (stockOverrides[sku] !== undefined) {
      stockQty = parseInt(stockOverrides[sku], 10);
      if (isNaN(stockQty) || stockQty < 0) stockQty = 0;
    }


    let targetStatus, targetPresence, targetInStock, targetQuantity;

    if (!isEnabled) {
      // Товар вимкнено для Prom (наприклад, запобіжники або вимкнені вручну):
      // Товар НЕ приховується (залишається 'on_display'), але статус встановлюється на "немає в наявності" (not_available, 0 шт.)
      targetStatus = 'on_display';
      targetPresence = 'not_available';
      targetInStock = false;
      targetQuantity = 0;
      disabledCount++;
    } else {
      targetStatus = 'on_display';
      if (stockQty > 0) {
        targetPresence = 'available';
        targetInStock = true;
        targetQuantity = stockQty;
        enabledInStockCount++;
      } else {
        targetPresence = 'not_available';
        targetInStock = false;
        targetQuantity = 0;
        enabledOutOfStockCount++;
      }
    }

    // Перевіряємо, чи є реальні зміни в порівнянні з поточним станом на Prom
    const needsUpdate = (
      p.status !== targetStatus ||
      p.presence !== targetPresence ||
      p.in_stock !== targetInStock ||
      (targetQuantity !== null && p.quantity_in_stock !== targetQuantity)
    );

    if (needsUpdate) {
      updates.push({
        id: p.id,
        sku: sku,
        name: p.name || '',
        status: targetStatus,
        presence: targetPresence,
        in_stock: targetInStock,
        quantity_in_stock: targetQuantity,
        _old: {
          status: p.status,
          presence: p.presence,
          in_stock: p.in_stock,
          quantity_in_stock: p.quantity_in_stock
        }
      });
    }
  }

  console.log('────────────────────────────────────────');
  console.log(`📊 Статистика товарів:`);
  console.log(`   🟢 В наявності (готовий до відправки): ${enabledInStockCount}`);
  console.log(`   🔴 Немає в наявності: ${enabledOutOfStockCount}`);
  console.log(`   ⚪ Вимкнено для Prom: ${disabledCount}`);
  console.log(`   ⚠️ Без артикулу (пропущено): ${skippedNoSku}`);
  console.log(`   ⏩ Інші бренди (пропущено): ${skippedOtherBrand}`);
  console.log(`   🔄 Потребують оновлення на Prom: ${updates.length}`);
  console.log('────────────────────────────────────────');

  if (updates.length === 0) {
    console.log('✨ Всі товари на Prom.ua вже в актуальному стані!');
    return { total: promProducts.length, updated: 0, errors: 0, failedDetails: [] };
  }

  if (isDryRun) {
    console.log(`🔎 [DRY-RUN] Зразок перших 5 товарів, які будуть оновлені:`);
    updates.slice(0, 5).forEach(u => {
      console.log(`   • [ID ${u.id}] SKU: ${u.sku} -> Status: ${u.status}, Presence: ${u.presence}, Qty: ${u.quantity_in_stock} (було: Presence ${u._old.presence}, Qty ${u._old.quantity_in_stock})`);
    });
    console.log('✅ DRY-RUN завершено успішно без внесення змін.');
    return { total: promProducts.length, wouldUpdate: updates.length, errors: 0, failedDetails: [] };
  }

  // 5. Відправка пачками по 100 товарів
  const BATCH_SIZE = 100;
  let totalProcessed = 0;
  let errorsCount = 0;
  const failedDetails = [];

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const chunk = updates.slice(i, i + BATCH_SIZE);
    const payload = chunk.map(u => ({
      id: u.id,
      status: u.status,
      presence: u.presence,
      in_stock: u.in_stock,
      quantity_in_stock: u.quantity_in_stock
    }));

    try {
      console.log(`📤 Відправка пачки ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(updates.length / BATCH_SIZE)} (${chunk.length} шт.)...`);
      const res = await client.post('/products/edit', payload);
      const resData = res.data || {};
      const processed = resData.processed_ids?.length || 0;
      totalProcessed += processed;

      if (resData.errors && Object.keys(resData.errors).length > 0) {
        console.warn(`   ⚠️ Помилки для деяких товарів:`, JSON.stringify(resData.errors));
        for (const [errId, errVal] of Object.entries(resData.errors)) {
          const item = chunk.find(c => String(c.id) === String(errId)) || promProducts.find(p => String(p.id) === String(errId));
          let reason = '';
          if (typeof errVal === 'string') {
            reason = errVal;
          } else if (errVal && typeof errVal === 'object') {
            if (errVal._schema && typeof errVal._schema === 'object') {
              reason = Object.values(errVal._schema).flat().join('; ');
            } else {
              reason = Object.entries(errVal).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ');
            }
          } else {
            reason = JSON.stringify(errVal);
          }

          failedDetails.push({
            id: errId,
            sku: item?.sku || 'без артикулу',
            name: item?.name || '',
            reason: reason
          });

          console.error(`   ❌ [Помилка Prom] Товар ID ${errId} (Арт: ${item?.sku || 'немає'}, "${item?.name || ''}"): ${reason}`);
        }
        errorsCount += Object.keys(resData.errors).length;
      }
    } catch (e) {
      console.error(`   ❌ Помилка відправки пачки:`, e.response?.data || e.message);
      errorsCount += chunk.length;
    }
  }

  console.log(`🎉 Синхронізацію з Prom.ua завершено! Оновлено: ${totalProcessed} товарів. Помилок: ${errorsCount}.`);
  return { total: promProducts.length, updated: totalProcessed, errors: errorsCount, failedDetails };
}

module.exports = syncProm;

if (require.main === module) {
  syncProm().catch(e => {
    console.error('💥 Критична помилка Prom sync:', e.message);
    process.exit(1);
  });
}
