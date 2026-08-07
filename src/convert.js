// ==========================================
// Конвертер Хорошоп XML → Мономаркет формати
// ==========================================
// Генерує:
//   feeds/products.xml  — товарний фід (Мономаркет <Market>)
//   feeds/prices.json   — прайс-лист (Мономаркет JSON)
// ==========================================

const { XMLParser } = require('fast-xml-parser');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ── Конфігурація ────────────────────────────────────────────────
const CONFIG = {
  // URL до вашого XML-фіду в Хорошопі (встановлюється через env або тут)
  horoshopFeedUrl: process.env.HOROSHOP_FEED_URL || '',

  // Якщо запускаємо локально з файлу замість URL
  localFeedPath: process.env.LOCAL_FEED_PATH || '',

  // Дефолтні значення для прайс-листа
  defaults: {
    // Залишок для всіх товарів (фіксоване значення, як ви і хочете)
    stock: parseInt(process.env.DEFAULT_STOCK || '10', 10),
    warehouseId: process.env.WAREHOUSE_ID || 'main',
    warrantyType: process.env.WARRANTY_TYPE || 'no',
    warrantyPeriod: parseInt(process.env.WARRANTY_PERIOD || '0', 10),
    maxPayInParts: parseInt(process.env.MAX_PAY_IN_PARTS || '6', 10),
    daysToDispatch: parseInt(process.env.DAYS_TO_DISPATCH || '1', 10),
  },

  // Назва магазину для XML-фіду
  shopName: process.env.SHOP_NAME || 'Магазин',

  // Назва поля `param` де зберігається штрихкод у Хорошопі
  // Зміните, якщо у вас інша назва (перевірте у своєму XML)
  barcodeParamNames: ['Штрихкод', 'Баркод', 'Barcode', 'EAN', 'GTIN', 'UPC'],
};

// ── Вихідна директорія ──────────────────────────────────────────
const FEEDS_DIR = path.join(__dirname, '..', 'feeds');
if (!fs.existsSync(FEEDS_DIR)) fs.mkdirSync(FEEDS_DIR, { recursive: true });

// ── Завантаження XML ────────────────────────────────────────────
async function fetchHoroshopXml() {
  if (CONFIG.localFeedPath) {
    console.log(`📂 Читаємо локальний файл: ${CONFIG.localFeedPath}`);
    return fs.readFileSync(CONFIG.localFeedPath, 'utf-8');
  }
  if (!CONFIG.horoshopFeedUrl) {
    throw new Error('❌ Не вказано HOROSHOP_FEED_URL або LOCAL_FEED_PATH');
  }
  console.log(`🌐 Завантажуємо фід: ${CONFIG.horoshopFeedUrl}`);
  const response = await axios.get(CONFIG.horoshopFeedUrl, {
    timeout: 30000,
    headers: { 'Accept-Encoding': 'gzip' },
  });
  return response.data;
}

// ── Парсинг Хорошоп XML ─────────────────────────────────────────
function parseHoroshopXml(xmlText) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '_',
    isArray: (name) => ['offer', 'picture', 'param'].includes(name),
    cdataPropName: '__cdata',
    parseAttributeValue: true,
    parseTagValue: true,
  });

  const result = parser.parse(xmlText);

  // Підтримка різних кореневих структур Хорошопу (yml_catalog або direct)
  const catalog = result.yml_catalog || result.catalog || result;
  const shop = catalog.shop || catalog;
  const offers = shop.offers?.offer || shop.offer || [];

  console.log(`✅ Знайдено ${offers.length} товарів у Хорошоп фіді`);
  return offers;
}

// ── Витягнути текст з CDATA або рядку ──────────────────────────
function extractText(val) {
  if (!val) return '';
  if (typeof val === 'string') return val.trim();
  if (val.__cdata) return val.__cdata.trim();
  if (Array.isArray(val)) return extractText(val[0]);
  return String(val).trim();
}

// ── Знайти param за назвою ──────────────────────────────────────
function findParam(params, names) {
  if (!params || !Array.isArray(params)) return null;
  const nameList = Array.isArray(names) ? names : [names];
  for (const p of params) {
    const pName = p.name || '';  // params вже трансформовані getParams() → {name, value}
    if (nameList.some((n) => pName.toLowerCase() === n.toLowerCase())) {
      return p.value || '';
    }
  }
  return null;
}

// ── Отримати всі params як масив об'єктів ──────────────────────
function getParams(offer) {
  const raw = offer.param;
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map((p) => ({
    name: p._name || '',
    value: extractText(p['#text'] ?? p.__cdata ?? p),
  }));
}

// ── Екранування XML ─────────────────────────────────────────────
function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ── Трансформація одного оферу ──────────────────────────────────
function transformOffer(offer) {
  const id = String(offer._id || '');
  const available = offer._available === true || offer._available === 'true';
  const params = getParams(offer);

  // Знаходимо штрихкод у params (назви можна розширити)
  const barcode =
    offer.barcode
      ? extractText(offer.barcode)
      : findParam(params, CONFIG.barcodeParamNames) || '';

  // Картинки
  const pictures = [];
  const rawPictures = offer.picture || [];
  const picList = Array.isArray(rawPictures) ? rawPictures : [rawPictures];
  for (const pic of picList) {
    const url = extractText(pic);
    if (url) pictures.push(url);
  }

  // Категорія
  const categoryId = String(offer._categoryId || offer.categoryId || '');
  const categoryName = extractText(offer.category) || categoryId;

  // Витягаємо опис
  const description = offer.description?.__cdata || extractText(offer.description) || '';

  return {
    // Ідентифікатори
    id,
    code: offer.article || offer.sku || id, // code для прайс-листа (збігається з <code> у XML)
    vendorCode: extractText(offer.vendorCode) || '',
    barcode,

    // Контент
    name: extractText(offer.name).replace(/\s+/g, ' '),
    brand: extractText(offer.vendor) || '',
    category: categoryName,
    description,
    pictures,
    params,

    // Ціна та наявність
    available,
    price: Math.round(parseFloat(offer.price) || 0),
    oldPrice: offer.old_price ? Math.round(parseFloat(offer.old_price)) : null,

    // Фізичні параметри (якщо є в XML)
    weight: offer.weight ? parseFloat(offer.weight) : null,
    height: offer.height ? parseFloat(offer.height) : null,
    width: offer.width ? parseFloat(offer.width) : null,
    length: offer.length || offer.depth ? parseFloat(offer.length || offer.depth) : null,
  };
}

// ════════════════════════════════════════════════════════════════
// ГЕНЕРАТОР: Товарний фід (Мономаркет XML <Market>)
// ════════════════════════════════════════════════════════════════
function generateProductsXml(offers) {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<Market>', '  <offers>'];

  for (const o of offers) {
    // Мономаркет вимагає лише товари в наявності у товарному фіді
    if (!o.available) continue;

    lines.push('    <offer>');
    lines.push(`      <id>${escapeXml(o.id)}</id>`);
    lines.push(`      <code>${escapeXml(o.code)}</code>`);
    lines.push(`      <vendor_code>${escapeXml(o.vendorCode)}</vendor_code>`);
    lines.push(`      <title><![CDATA[${o.name}]]></title>`);

    if (o.barcode) {
      lines.push(`      <barcode>${escapeXml(o.barcode)}</barcode>`);
    }

    lines.push(`      <category>${escapeXml(o.category)}</category>`);
    lines.push(`      <brand>${escapeXml(o.brand)}</brand>`);
    lines.push(`      <availability>Є в наявності</availability>`);

    // Фізичні характеристики (якщо є)
    if (o.weight !== null) lines.push(`      <weight>${o.weight}</weight>`);
    if (o.height !== null) lines.push(`      <height>${o.height}</height>`);
    if (o.width !== null) lines.push(`      <width>${o.width}</width>`);
    if (o.length !== null) lines.push(`      <length>${o.length}</length>`);

    // Опис
    if (o.description) {
      lines.push(`      <description><![CDATA[${o.description}]]></description>`);
    }

    // Фотографії
    if (o.pictures.length > 0) {
      lines.push('      <image_link>');
      for (const pic of o.pictures) {
        lines.push(`        <picture>${escapeXml(pic)}</picture>`);
      }
      lines.push('      </image_link>');
    }

    // Характеристики
    if (o.params.length > 0) {
      lines.push('      <tags>');
      for (const p of o.params) {
        if (p.name && p.value) {
          lines.push(`        <param name="${escapeXml(p.name)}">${escapeXml(p.value)}</param>`);
        }
      }
      lines.push('      </tags>');
    }

    lines.push('    </offer>');
  }

  lines.push('  </offers>', '</Market>');
  return lines.join('\n');
}

// ════════════════════════════════════════════════════════════════
// ГЕНЕРАТОР: Прайс-лист (Мономаркет JSON)
// ════════════════════════════════════════════════════════════════
function generatePricesJson(offers) {
  const now = new Date().toISOString();
  const d = CONFIG.defaults;

  // Включаємо ВСІ товари в прайс — навіть недоступні (availability: false)
  // Якщо товару немає в прайсі — Мономаркет автоматично вимикає його
  const data = offers.map((o) => ({
    code: o.code,
    price: o.price,
    old_price: o.oldPrice,
    availability: o.available,
    stock: o.available ? d.stock : 0,
    warehouses: o.available
      ? [{ id: d.warehouseId, stock: d.stock }]
      : null,
    warranty_type: d.warrantyType,
    warranty_period: d.warrantyPeriod,
    max_pay_in_parts: d.maxPayInParts,
    days_to_dispatch: d.daysToDispatch,
    manufacture: null,
  }));

  return JSON.stringify(
    {
      updatedAt: now,
      total: data.length,
      data,
    },
    null,
    2
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════
async function main() {
  const isTest = process.argv.includes('--test');
  console.log('🚀 Запуск конвертера Хорошоп → Мономаркет');
  console.log(`   Режим: ${isTest ? 'TEST (локальний файл)' : 'PRODUCTION'}`);
  console.log(`   Час: ${new Date().toISOString()}`);
  console.log('');

  try {
    // 1. Завантажити XML
    const xmlText = await fetchHoroshopXml();

    // 2. Парсинг
    const rawOffers = parseHoroshopXml(xmlText);

    // 3. Трансформація
    const offers = rawOffers.map(transformOffer);
    const availableCount = offers.filter((o) => o.available).length;
    console.log(`   В наявності: ${availableCount} / ${offers.length}`);

    // 4. Генерація файлів
    const productsXml = generateProductsXml(offers);
    const pricesJson = generatePricesJson(offers);

    // 5. Збереження
    const productsPath = path.join(FEEDS_DIR, 'products.xml');
    const pricesPath = path.join(FEEDS_DIR, 'prices.json');

    fs.writeFileSync(productsPath, productsXml, 'utf-8');
    fs.writeFileSync(pricesPath, pricesJson, 'utf-8');

    console.log('');
    console.log(`✅ feeds/products.xml — ${availableCount} товарів`);
    console.log(`✅ feeds/prices.json  — ${offers.length} пропозицій`);
    console.log('');

    // Статистика
    const missingBarcode = offers.filter((o) => o.available && !o.barcode);
    const missingBrand = offers.filter((o) => o.available && !o.brand);
    const missingVendorCode = offers.filter((o) => o.available && !o.vendorCode);

    if (missingBarcode.length > 0) {
      console.warn(`⚠️  ${missingBarcode.length} товарів БЕЗ штрихкоду (Мономаркет може відхилити)`);
      if (missingBarcode.length <= 5) {
        missingBarcode.forEach((o) => console.warn(`   - [${o.id}] ${o.name.slice(0, 50)}`));
      }
    }
    if (missingBrand.length > 0) {
      console.warn(`⚠️  ${missingBrand.length} товарів БЕЗ бренду`);
    }
    if (missingVendorCode.length > 0) {
      console.warn(`⚠️  ${missingVendorCode.length} товарів БЕЗ vendor_code`);
    }

    if (missingBarcode.length === 0 && missingBrand.length === 0) {
      console.log('🎉 Всі обов\'язкові поля заповнені!');
    }
  } catch (err) {
    console.error('❌ Помилка:', err.message);
    process.exit(1);
  }
}

main();
