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
    for (const article of alwaysAvailable) {
      availabilityOverrides[article] = true;
      // We also track stock overrides for iteration
      stockOverrides[article] = 10;
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
  // Беремо всі артикули, про які знаємо з таблиці
  const articles = Object.keys(stockOverrides);
  if (articles.length === 0) {
    console.log('⚠️ Немає товарів для оновлення (stock.json порожній).');
    return;
  }

  const products = [];
  for (const article of articles) {
    const isAvailable = availabilityOverrides[article] || false;
    const isWhitelisted = whitelist.includes(article);
    const isAlwaysAvailable = alwaysAvailable.includes(article);

    // Якщо товар у списку "Завжди 10", ми примусово вмикаємо йому 6 платежів на Хорошопі, 
    // навіть якщо для самого Мономаркету він вимкнений (isWhitelisted = false).
    // Якщо ж він не в списку "Завжди 10", тоді діє стандартне правило: (Увімкнено + Є в наявності).
    const monoInstallmentsId = (isAlwaysAvailable || (isWhitelisted && isAvailable)) ? 6 : 1;

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
