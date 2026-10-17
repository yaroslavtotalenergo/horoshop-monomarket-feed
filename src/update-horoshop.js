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
  let installmentsActiveCount = 0;

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

    if (targetPresence === 'В наявності') {
      inStockCount++;
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

    // Відправляємо ВИКЛЮЧНО presence та monobank_installments_payment. Жодні інші поля не чіпаємо!
    products.push({
      article: article,
      presence: targetPresence,
      monobank_installments_payment: {
        id: monoInstallmentsId
      }
    });
  }

  console.log(`📊 Статистика для Хорошопу:`);
  console.log(`   🟢 В наявності: ${inStockCount}`);
  console.log(`   🔴 Немає в наявності: ${outOfStockCount}`);
  console.log(`   🟣 Оплата частинами активна (6 пл.): ${installmentsActiveCount}`);

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
