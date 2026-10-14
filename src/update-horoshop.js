const axios = require('axios');
const fs = require('fs');

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
  let availabilityOverrides = {};
  let whitelist = [];
  let alwaysAvailable = [];
  let horoshopDisabled = [];

  try {
    if (fs.existsSync('src/stock.json')) {
      stockOverrides = JSON.parse(fs.readFileSync('src/stock.json', 'utf8'));
    }
    if (fs.existsSync('src/availability.json')) {
      availabilityOverrides = JSON.parse(fs.readFileSync('src/availability.json', 'utf8'));
    }
    if (fs.existsSync('src/whitelist.json')) {
      whitelist = JSON.parse(fs.readFileSync('src/whitelist.json', 'utf8'));
    }
    
    if (fs.existsSync('src/always-available.json')) {
      alwaysAvailable = JSON.parse(fs.readFileSync('src/always-available.json', 'utf8'));
    }
    if (fs.existsSync('src/horoshop-disabled.json')) {
      horoshopDisabled = JSON.parse(fs.readFileSync('src/horoshop-disabled.json', 'utf8'));
    }
    for (const article of alwaysAvailable) {
      availabilityOverrides[article] = true;
      // We also track stock overrides for iteration
      stockOverrides[article] = Math.max(stockOverrides[article] || 0, 10);
    }
  } catch (e) {
    console.error('❌ Помилка читання файлів:', e.message);
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
      console.error('❌ Помилка авторизації:', authRes.data);
      return;
    }
    token = authRes.data.response.token;
    console.log('✅ Авторизація успішна, отримано токен.');
  } catch (e) {
    console.error('❌ Помилка запиту авторизації:', e.message);
    if (e.response) console.error(e.response.data);
    return;
  }

  // 3. Формуємо масив товарів для оновлення
  const articleSet = new Set(Object.keys(stockOverrides));
  for (const a of alwaysAvailable) articleSet.add(a);
  for (const a of horoshopDisabled) articleSet.add(a);

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
    console.log('⚠️ Немає товарів для оновлення (stock.json порожній).');
    return;
  }

  const products = [];
  for (const article of articles) {
    const isDisabled = horoshopDisabled.includes(article);
    const isAlwaysAvailable = alwaysAvailable.includes(article);
    const rawStock = stockOverrides[article] !== undefined ? parseInt(stockOverrides[article], 10) : 0;
    const stock = isNaN(rawStock) ? 0 : rawStock;
    const isAvailable = availabilityOverrides[article] !== false && stock > 0;

    // Логіка Оплати частинами (Монобанк) для Хорошопу:
    // 1. Якщо товар заборонено в адмінці (в списку horoshopDisabled) -> ОЧ вимкнено (id: 1) навіть якщо є на складі.
    // 2. Якщо товар увімкнено примусово (alwaysAvailable) -> ОЧ увімкнено (id: 6).
    // 3. Якщо товар є в наявності на складі (stock > 0) -> ОЧ увімкнено (id: 6).
    // 4. Інакше (немає на складі) -> ОЧ вимкнено (id: 1).
    let monoInstallmentsId = 1;
    if (!isDisabled) {
      if (isAlwaysAvailable || isAvailable) {
        monoInstallmentsId = 6;
      }
    }

    // Відправляємо ТІЛЬКИ налаштування Оплати частинами. Більше НІЧОГО не чіпаємо.
    products.push({
      article: article,
      monobank_installments_payment: {
        id: monoInstallmentsId
      }
    });
  }

  // --- DIAGNOSTIC START ---
  try {
    console.log('--- DIAGNOSTIC: Отримуємо 1 товар з Хорошопу для перевірки полів ---');
    const exportUrl = `https://${DOMAIN}/api/catalog/export/?token=${token}&limit=1`;
    const expRes = await axios.get(exportUrl);
    const items = expRes.data?.response?.data || [];
    if (items.length > 0) {
      const item = items[0];
      const monoKeys = Object.keys(item).filter(k => k.toLowerCase().includes('mono') || k.toLowerCase().includes('pay') || k.toLowerCase().includes('installment'));
      console.log('Знайдені поля для Монобанку/Оплат:', monoKeys);
      for (const k of monoKeys) {
        console.log(`Поле ${k} =`, JSON.stringify(item[k]));
      }
    }
  } catch(err) {
    console.log('Diagnostic error:', err.message);
  }
  // --- DIAGNOSTIC END ---

  console.log(`📦 Підготовлено ${products.length} товарів для відправки в Хорошоп...`);

  // 4. Відправляємо в Хорошоп
  try {
    const importUrl = `https://${DOMAIN}/api/catalog/import/`;
    const importRes = await axios.post(importUrl, {
      token: token,
      products: products
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    const data = importRes.data;
    if (data.status === 'OK') {
      console.log('✅ Всі товари успішно оновлено через API!');
    } else if (data.status === 'WARNING') {
      console.warn('⚠️ Оновлено з попередженнями. Перевірте логи в адмінці Хорошопу (Налаштування -> Логи API).');
      // Можна вивести частину логів
      if (data.response && data.response.log) {
        const errors = data.response.log.filter(l => l.info && l.info.some(i => i.code !== 0 && i.code !== 15));
        if (errors.length > 0) {
          console.warn('Деякі помилки з логу:', JSON.stringify(errors.slice(0, 3), null, 2));
        }
      }
    } else {
      console.error('❌ Помилка оновлення товарів:', data);
    }
  } catch (e) {
    console.error('❌ Помилка запиту імпорту:', e.message);
    if (e.response) console.error(JSON.stringify(e.response.data, null, 2));
  }
}

if (require.main === module) {
  updateHoroshop();
}

module.exports = updateHoroshop;
