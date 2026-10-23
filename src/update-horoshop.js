const axios = require('axios');
const fs = require('fs');

// ── Налаштування «Під замовлення» (режим Авто, залишок 0) ─────────────
// Поки що діє ТІЛЬКИ для бренду Victron Energy.
const PREORDER_BRAND = 'victron';
const PREORDER_STATUS = 'Під замовлення';
const PREORDER_ICON = 'Під замовлення';
const PREORDER_TEXT = {
  ua: 'Замовляємо обладнання Victron Energy щопонеділка, термін постачання 15-18 днів!',
  ru: 'Заказываем оборудование Victron Energy каждый понедельник, срок поставки 15-18 дней!',
  en: 'We order Victron Energy equipment every Monday, delivery time 15-18 days!'
};
const SHORT_DESC_BACKUP_FILE = 'src/horoshop-short-desc-backup.json';
const DRY_RUN = process.env.HOROSHOP_DRY_RUN === '1';

// Будь-яке значення (рядок / об'єкт мов / масив) → плоский текст
function toText(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.map(toText).join(' ');
  if (typeof v === 'object') return Object.values(v).map(toText).join(' ');
  return '';
}

function cleanText(s) {
  return String(s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

// Ключ мови Хорошопу → наш текст (ua/uk → ua, ru → ru, en → en)
function preorderTextForLang(lang) {
  const l = String(lang).toLowerCase();
  if (l.startsWith('ru')) return PREORDER_TEXT.ru;
  if (l.startsWith('en')) return PREORDER_TEXT.en;
  return PREORDER_TEXT.ua;
}

// Короткий опис як об'єкт мов { ua: '...', ru: '...', en: '...' }
function shortDescToObject(sd) {
  if (sd && typeof sd === 'object' && !Array.isArray(sd)) return sd;
  if (typeof sd === 'string' && sd.trim()) return { ua: sd };
  return {};
}

// Чи стоїть уже наш текст у всіх мовах
function isFullyPreorderText(sd, langs) {
  const obj = shortDescToObject(sd);
  return langs.every(l => cleanText(obj[l]) === preorderTextForLang(l));
}

// Чи є наш текст хоча б в одній мові
function containsPreorderText(sd) {
  const t = cleanText(toText(sd));
  return Object.values(PREORDER_TEXT).some(p => t.includes(p));
}

// Іконка з експорту → назва. Повертає null, якщо формат невідомий.
function iconName(icon) {
  if (typeof icon === 'string') return icon.trim();
  if (icon && typeof icon === 'object') {
    const cand = icon.value ?? icon.name ?? icon.title;
    if (typeof cand === 'string') return cand.trim();
    if (cand && typeof cand === 'object') {
      const v = cand.ua ?? cand.uk ?? Object.values(cand)[0];
      if (typeof v === 'string') return v.trim();
    }
  }
  return null;
}

function sameIcon(a, b) {
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

// Бренди з feeds/products.xml (запасний варіант, якщо експорт не повернув бренд)
function loadFeedBrands() {
  const map = {};
  try {
    if (!fs.existsSync('feeds/products.xml')) return map;
    const xml = fs.readFileSync('feeds/products.xml', 'utf8');
    for (const chunk of xml.split(/<offer[\s>]/).slice(1)) {
      const code = (chunk.match(/<vendor_code>([^<]*)<\/vendor_code>/) || [])[1];
      const brand = (chunk.match(/<brand>([^<]*)<\/brand>/) || [])[1];
      if (code && brand) map[code.trim()] = brand.trim();
    }
  } catch (e) {
    console.warn('⚠️ Не вдалося прочитати бренди з products.xml:', e.message);
  }
  return map;
}

// Читаємо з Хорошопу поточні бренд / іконки / короткий опис усіх товарів
async function fetchHoroshopProducts(domain, token) {
  const url = `https://${domain}/api/catalog/export/`;
  const map = {};
  const limit = 500;
  for (let offset = 0; offset < 100000; offset += limit) {
    const res = await axios.post(url, {
      token,
      offset,
      limit,
      includedParams: ['article', 'brand', 'icons', 'short_description']
    }, { headers: { 'Content-Type': 'application/json' } });

    const data = res.data || {};
    const list = data.response?.products || [];
    if (data.status !== 'OK') {
      if (offset > 0 && list.length === 0) break; // кінець списку
      throw new Error(data.response?.message || data.message || JSON.stringify(data).slice(0, 300));
    }
    for (const p of list) {
      if (p && p.article !== undefined && p.article !== null) map[String(p.article).trim()] = p;
    }
    if (list.length < limit) break;
  }
  return map;
}

async function updateHoroshop() {
  let DOMAIN = process.env.HOROSHOP_DOMAIN || '';
  DOMAIN = DOMAIN.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const LOGIN = process.env.HOROSHOP_API_LOGIN;
  const PASSWORD = process.env.HOROSHOP_API_PASSWORD;

  if (!DOMAIN || !LOGIN || !PASSWORD) {
    console.log('⚠️ Дані для API Хорошопу не задані (DOMAIN, LOGIN, PASSWORD). Пропускаємо оновлення по API.');
    return;
  }

  console.log(`🚀 Починаємо оновлення каталогу через API на сайті: ${DOMAIN}`);

  // 1. Читаємо наші локальні дані
  let stockOverrides = {};
  let horoshopPresence = {};
  let horoshopInstallments = {};
  let alwaysAvailable = [];

  try {
    if (fs.existsSync('src/stock.json')) {
      stockOverrides = JSON.parse(fs.readFileSync('src/stock.json', 'utf8'));
    }
    if (fs.existsSync('src/horoshop-presence.json')) {
      horoshopPresence = JSON.parse(fs.readFileSync('src/horoshop-presence.json', 'utf8'));
    }
    if (fs.existsSync('src/horoshop-installments.json')) {
      horoshopInstallments = JSON.parse(fs.readFileSync('src/horoshop-installments.json', 'utf8'));
    }
    if (fs.existsSync('src/always-available.json')) {
      alwaysAvailable = JSON.parse(fs.readFileSync('src/always-available.json', 'utf8'));
    }
  } catch (e) {
    console.error('❌ Помилка читання файлів налаштувань:', e.message);
    return;
  }

  // 2. Авторизація в API
  let token = '';
  try {
    const authUrl = `https://${DOMAIN}/api/auth/`;
    console.log(`🔑 Авторизація: ${authUrl}`);
    const authRes = await axios.post(authUrl, {
      login: LOGIN,
      password: PASSWORD
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    if (authRes.data.status !== 'OK') {
      const errDetail = authRes.data.response?.message || authRes.data.message || JSON.stringify(authRes.data);
      console.error('❌ Помилка авторизації:', errDetail);
      const { notifyError } = require('./notify');
      await notifyError('Помилка авторизації Хорошоп API', errDetail);
      return;
    }
    token = authRes.data.response.token;
    console.log('✅ Авторизація успішна, отримано токен.');
  } catch (e) {
    const errMsg = e.response?.data?.response?.message || e.response?.data?.message || e.message;
    console.error('❌ Помилка запиту авторизації:', errMsg);
    const { notifyError } = require('./notify');
    await notifyError('Помилка запиту авторизації Хорошоп API', errMsg);
    return;
  }

  // 2.1 Поточний стан товарів у Хорошопі (бренд, іконки, короткий опис)
  let horoshopProducts = null;
  try {
    horoshopProducts = await fetchHoroshopProducts(DOMAIN, token);
    console.log(`📥 Отримано з Хорошопу ${Object.keys(horoshopProducts).length} товарів (бренд/іконки/короткий опис).`);
  } catch (e) {
    const errMsg = e.response?.data?.response?.message || e.response?.data?.message || e.message;
    console.error('❌ Не вдалося отримати товари з Хорошопу (export):', errMsg);
    console.warn('⚠️ Іконки та короткий опис НЕ чіпаємо в цьому запуску (щоб не стерти наявні).');
    horoshopProducts = null;
  }

  // Мови короткого опису: беремо з того, що повертає Хорошоп, інакше ua/ru/en
  let shortDescLangs = ['ua', 'ru', 'en'];
  if (horoshopProducts) {
    const sample = Object.values(horoshopProducts).find(
      p => p.short_description && typeof p.short_description === 'object' && !Array.isArray(p.short_description)
    );
    if (sample) shortDescLangs = Object.keys(sample.short_description);
  }
  const feedBrands = loadFeedBrands();

  let shortDescBackup = {};
  try {
    if (fs.existsSync(SHORT_DESC_BACKUP_FILE)) {
      shortDescBackup = JSON.parse(fs.readFileSync(SHORT_DESC_BACKUP_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('⚠️ Не вдалося прочитати резервні короткі описи:', e.message);
  }
  let backupChanged = false;

  // 3. Формуємо масив товарів для оновлення
  const articleSet = new Set(Object.keys(stockOverrides));
  for (const a of Object.keys(horoshopPresence)) articleSet.add(a);
  for (const a of Object.keys(horoshopInstallments)) articleSet.add(a);
  for (const a of alwaysAvailable) articleSet.add(a);

  if (fs.existsSync('feeds/catalog.json')) {
    try {
      const cat = JSON.parse(fs.readFileSync('feeds/catalog.json', 'utf8'));
      for (const p of cat) {
        if (p.vendorCode) articleSet.add(String(p.vendorCode).trim());
      }
    } catch (e) {}
  }

  const articles = Array.from(articleSet);
  if (articles.length === 0) {
    console.log('⚠️ Немає товарів для оновлення.');
    return;
  }

  const products = [];
  let inStockCount = 0;
  let outOfStockCount = 0;
  let preorderCount = 0;
  let installmentsActiveCount = 0;
  let iconsChangedCount = 0;
  let shortDescChangedCount = 0;

  for (const article of articles) {
    const rawStock = stockOverrides[article] !== undefined ? parseInt(stockOverrides[article], 10) : 0;
    const stock = isNaN(rawStock) || rawStock < 0 ? 0 : rawStock;

    // ── 1. Визначення Наявності (presence) ──────────────────────────
    // Режими: 'off' (примусово немає), 'on' (примусово є), 'auto' (за залишком)
    const presenceMode = horoshopPresence[article] || 'auto';
    let targetPresence = 'Немає в наявності';

    if (presenceMode === 'off') {
      targetPresence = 'Немає в наявності';
    } else if (presenceMode === 'on') {
      targetPresence = 'В наявності';
    } else {
      // auto: якщо на складі > 0 -> "В наявності", інакше "Немає в наявності"
      targetPresence = stock > 0 ? 'В наявності' : 'Немає в наявності';
    }

    // ── 1.1 Victron: Авто + залишок 0 → «Під замовлення» ─────────────
    const hp = horoshopProducts ? horoshopProducts[article] : null;
    const brandText = (hp && toText(hp.brand)) || feedBrands[article] || '';
    const isPreorderBrand = brandText.toLowerCase().includes(PREORDER_BRAND);
    const wantPreorder = isPreorderBrand && presenceMode === 'auto' && stock === 0;

    if (wantPreorder) {
      targetPresence = PREORDER_STATUS;
    }

    if (targetPresence === 'В наявності') {
      inStockCount++;
    } else if (targetPresence === PREORDER_STATUS) {
      preorderCount++;
    } else {
      outOfStockCount++;
    }

    // ── 2. Визначення Оплати частинами (monobank_installments_payment) ──
    // Режими: 'off' (заборонено), 'on' (примусово), 'auto' (якщо в наявності та stock > 0)
    const installmentsMode = horoshopInstallments[article] || 'auto';

    let monoInstallmentsId = 1; // 1 = вимкнено
    if (presenceMode === 'off') {
      // Якщо товар примусово знято з продажу на Хорошопі, ОЧ завжди вимикається
      monoInstallmentsId = 1;
    } else if (installmentsMode === 'off') {
      monoInstallmentsId = 1;
    } else if (installmentsMode === 'on') {
      monoInstallmentsId = 6;
    } else {
      // auto: вмикається, тільки якщо товар реально в наявності та залишок > 0
      if (targetPresence === 'В наявності' && stock > 0) {
        monoInstallmentsId = 6;
      } else {
        monoInstallmentsId = 1;
      }
    }

    if (monoInstallmentsId === 6) {
      installmentsActiveCount++;
    }

    // Відправляємо presence та monobank_installments_payment.
    // Для Victron додатково icons / short_description (тільки якщо треба щось змінити).
    // ОСНОВНИЙ ОПИС (description) НІКОЛИ НЕ ПЕРЕДАЄМО!
    const product = {
      article: article,
      presence: targetPresence,
      monobank_installments_payment: {
        id: monoInstallmentsId
      }
    };

    if (hp && isPreorderBrand) {
      // ── Іконки: зберігаємо наявні, лише додаємо/прибираємо «Під замовлення»
      const rawIcons = Array.isArray(hp.icons) ? hp.icons : [];
      const currentIcons = rawIcons.map(iconName);
      if (currentIcons.some(n => n === null)) {
        console.warn(`   ⚠️ ${article}: невідомий формат іконок, іконки не змінюємо.`);
      } else {
        const hasIcon = currentIcons.some(n => sameIcon(n, PREORDER_ICON));
        if (wantPreorder && !hasIcon) {
          product.icons = [...currentIcons, PREORDER_ICON];
        } else if (!wantPreorder && hasIcon) {
          product.icons = currentIcons.filter(n => !sameIcon(n, PREORDER_ICON));
        }
        if (product.icons) iconsChangedCount++;
      }

      // ── Короткий опис
      if (wantPreorder && !isFullyPreorderText(hp.short_description, shortDescLangs)) {
        // Якщо там був свій текст — зберігаємо його, щоб повернути, коли товар з'явиться
        if (!containsPreorderText(hp.short_description) && cleanText(toText(hp.short_description))) {
          shortDescBackup[article] = shortDescToObject(hp.short_description);
          backupChanged = true;
        }
        product.short_description = {};
        for (const l of shortDescLangs) product.short_description[l] = preorderTextForLang(l);
        shortDescChangedCount++;
      } else if (!wantPreorder && containsPreorderText(hp.short_description)) {
        // Товар повернувся: відновлюємо попередній короткий опис (або очищаємо)
        const backup = shortDescBackup[article] || {};
        product.short_description = {};
        for (const l of shortDescLangs) product.short_description[l] = backup[l] || '';
        if (shortDescBackup[article]) {
          delete shortDescBackup[article];
          backupChanged = true;
        }
        shortDescChangedCount++;
      }
    }

    products.push(product);
  }

  if (backupChanged && !DRY_RUN) {
    try {
      fs.writeFileSync(SHORT_DESC_BACKUP_FILE, JSON.stringify(shortDescBackup, null, 2), 'utf8');
    } catch (e) {
      console.warn('⚠️ Не вдалося зберегти резервні короткі описи:', e.message);
    }
  }

  console.log(`📊 Статистика для Хорошопу:`);
  console.log(`   🟢 В наявності: ${inStockCount}`);
  console.log(`   🟡 Під замовлення (Victron): ${preorderCount}`);
  console.log(`   🔴 Немає в наявності: ${outOfStockCount}`);
  console.log(`   🟣 Оплата частинами активна (6 пл.): ${installmentsActiveCount}`);
  console.log(`   🏷️ Змін іконок: ${iconsChangedCount}, змін короткого опису: ${shortDescChangedCount}`);

  if (DRY_RUN) {
    const changed = products.filter(p => p.icons || p.short_description || p.presence === PREORDER_STATUS);
    console.log('🧪 DRY RUN: нічого не відправляємо. Приклади змін:');
    console.log(JSON.stringify(changed.slice(0, 5), null, 2));
    return;
  }

  // 4. Відправляємо в Хорошоп пачками по 250 шт. (згідно з рекомендаціями документації)
  const CHUNK_SIZE = 250;
  const totalBatches = Math.ceil(products.length / CHUNK_SIZE);
  console.log(`📦 Підготовлено ${products.length} товарів (${totalBatches} пачок)...`);

  let totalUpdated = 0;
  const importErrors = [];
  const importUrl = `https://${DOMAIN}/api/catalog/import/`;

  for (let i = 0; i < products.length; i += CHUNK_SIZE) {
    const chunk = products.slice(i, i + CHUNK_SIZE);
    const batchNum = Math.floor(i / CHUNK_SIZE) + 1;

    console.log(`📤 Відправка пачки ${batchNum}/${totalBatches} (${chunk.length} шт.)...`);

    try {
      const importRes = await axios.post(importUrl, {
        token: token,
        products: chunk
      }, {
        headers: { 'Content-Type': 'application/json' }
      });

      const data = importRes.data;
      if (data.status === 'OK') {
        totalUpdated += chunk.length;
        console.log(`   ✅ Пачка ${batchNum}/${totalBatches} успішно імпортована.`);
      } else if (data.status === 'WARNING') {
        totalUpdated += chunk.length;
        console.warn(`   ⚠️ Пачка ${batchNum}/${totalBatches} імпортована з попередженнями.`);
      } else {
        const batchErrMsg = `Пачка ${batchNum}: ${data.response?.message || data.message || JSON.stringify(data)}`;
        console.error(`   ❌ Помилка імпорту:`, batchErrMsg);
        importErrors.push(batchErrMsg);
      }
    } catch (e) {
      const reqErrMsg = `Пачка ${batchNum}: ${e.response?.data?.message || e.message}`;
      console.error(`   ❌ Помилка запиту для пачки ${batchNum}:`, reqErrMsg);
      importErrors.push(reqErrMsg);
    }
  }

  if (importErrors.length > 0) {
    const { notifyError } = require('./notify');
    await notifyError('Помилка оновлення товарів у Хорошоп API', importErrors.slice(0, 3).join('\n'));
  }

  console.log(`🎉 Оновлення Хорошопу завершено! Оброблено: ${totalUpdated} товарів.`);
}

if (require.main === module) {
  updateHoroshop().catch(async (e) => {
    console.error('💥 Критична помилка Хорошоп API:', e.message);
    const { notifyError } = require('./notify');
    await notifyError('Критична помилка оновлення Хорошоп', e.message);
    process.exit(1);
  });
}

module.exports = updateHoroshop;
