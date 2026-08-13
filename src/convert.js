// ==========================================
// Конвертер Хорошоп XML → Мономаркет формати
// ==========================================
// Генерує:
//   feeds/products.xml  — товарний фід (Мономаркет <Market>)
//   feeds/prices.json   — прайс-лист (Мономаркет JSON)
//   feeds/catalog.json  — каталог товарів
// ==========================================

const { XMLParser } = require('fast-xml-parser');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ── Зчитування конфігураційних файлів ──────────────────────────
let barcodesConfig = {};
try {
  barcodesConfig = JSON.parse(fs.readFileSync('src/barcodes.json', 'utf8'));
} catch (e) {
  console.log('Файл barcodes.json не знайдено або пустий.');
}

let config = {};
try { config = JSON.parse(fs.readFileSync('src/config.json', 'utf8')); } catch(e) {}

let whitelist = [];
try { whitelist = JSON.parse(fs.readFileSync('src/whitelist.json', 'utf8')); } catch(e) {}

let customDescriptions = {};
try { customDescriptions = JSON.parse(fs.readFileSync('src/descriptions.json', 'utf8')); } catch(e) {}

let categoryMap = {};
try { categoryMap = JSON.parse(fs.readFileSync('src/categories.json', 'utf8')); } catch(e) {}

let availabilityOverrides = {};
try { availabilityOverrides = JSON.parse(fs.readFileSync('src/availability.json', 'utf8')); } catch(e) {}

// ── Налаштування ────────────────────────────────────────────────
const CONFIG = {
  horoshopFeedUrl: config.horoshopFeedUrl || process.env.HOROSHOP_FEED_URL || '',
  localFeedPath: process.env.LOCAL_FEED_PATH || '',

  defaults: {
    stock: parseInt(process.env.DEFAULT_STOCK || '10', 10),
    warehouseId: process.env.WAREHOUSE_ID || 'main',
    warrantyType: process.env.WARRANTY_TYPE || 'manufacturer',
    warrantyPeriod: parseInt(process.env.WARRANTY_PERIOD || '60', 10),
    maxPayInParts: parseInt(process.env.MAX_PAY_IN_PARTS || '6', 10),
    daysToDispatch: parseInt(process.env.DAYS_TO_DISPATCH || '1', 10),
  },

  shopName: process.env.SHOP_NAME || 'Магазин',
  maxProducts: parseInt(process.env.MAX_PRODUCTS || '0', 10),
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
    const pName = p.name || '';
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

  const excludedParams = ['Гарантия', 'Гарантія', 'Цвет', 'Колір'];

  return list
    .map((p) => {
      let pName = p._name || '';
      // Remove trailing colon and spaces (e.g. "Напруга заряду:" -> "Напруга заряду")
      pName = pName.replace(/:\s*$/, '').trim();
      return {
        name: pName,
        value: extractText(p['#text'] ?? p.__cdata ?? p),
      };
    })
    .filter((p) => !excludedParams.includes(p.name));
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

// ── Форматування назви під вимоги Мономаркету ───────────────────
function formatProductName(originalName, vendorCode) {
  let name = String(originalName || '').replace(/\s+/g, ' ').trim();

  const forbidden = [
    /акція/ig, /знижка/ig, /розпродаж/ig, /уцінка/ig, 
    /\bcopy\b/ig, /\boriginal\b/ig, 
    /https?:\/\/\S+/ig, /www\.\S+/ig
  ];
  for (const reg of forbidden) {
    name = name.replace(reg, '');
  }

  name = name.replace(/[§≠≥]/g, '');

  if (vendorCode && name.endsWith(`- ${vendorCode}`)) {
    name = name.slice(0, name.lastIndexOf(`- ${vendorCode}`)).trim();
    name = `${name} (${vendorCode})`;
  }

  return name.replace(/\s+/g, ' ').trim();
}

// ── Очистка оригінального опису від заборонених даних ────────────────
function cleanDescription(desc) {
  if (!desc) return '';
  let d = desc;

  d = d.replace(/<table[^>]*>[\s\S]*?<\/table>/ig, '');
  d = d.replace(/<h[2-5][^>]*>[^<]*комплект[^<]*<\/h[2-5]>[\s\S]*?<\/[ou]l>/ig, '');
  d = d.replace(/<h[2-5][^>]*>[^<]*(Відмінності|Порівняння)[^<]*<\/h[2-5]>/ig, '');
  d = d.replace(/<p[^>]*>[^<]*модельний ряд[^<]*<\/p>/ig, '');

  const badPhrases = [
    /Total-?Energo/ig,
    /Тотал-?Енерго/ig,
    /надаємо сервіс/ig,
    /сервісний центр/ig,
    /офіційний представник/ig,
    /гарантійне обслуговування/ig
  ];
  for (const reg of badPhrases) {
    d = d.replace(reg, '');
  }

  d = d.replace(/<p[^>]*>\s*(?:&nbsp;)?\s*<\/p>/ig, '');
  return d.trim();
}

// ── Трансформація одного оферу ──────────────────────────────────
function transformOffer(offer) {
  const id = String(offer._id || '');
  const params = getParams(offer);
  const vendorCode = extractText(offer.vendorCode) || '';
  
  let available = offer._available === true || offer._available === 'true';
  if (availabilityOverrides[vendorCode] !== undefined) {
    available = availabilityOverrides[vendorCode];
  }

  const barcode =
    barcodesConfig[vendorCode] || 
    (offer.barcode ? extractText(offer.barcode) : findParam(params, CONFIG.barcodeParamNames)) || 
    '';

  const pictures = [];
  const rawPictures = offer.picture || [];
  const picList = Array.isArray(rawPictures) ? rawPictures : [rawPictures];
  for (const pic of picList) {
    const url = extractText(pic);
    if (url) pictures.push(url);
  }

  const categoryId = String(offer._categoryId || offer.categoryId || '');
  let categoryName = categoryMap[vendorCode] || extractText(offer.category) || categoryId;
  if (categoryName === '1229' || categoryId === '1229') {
    categoryName = 'Акумулятори';
  }
  const description = offer.description?.__cdata || extractText(offer.description) || '';

  return {
    // Ідентифікатори
    id,
    code: vendorCode || id, // Головний ідентифікатор - артикул. Якщо його немає (що рідкість) - беремо ID
    vendorCode,
    barcode,

    // Контент
    name: formatProductName(extractText(offer.name), vendorCode),
    brand: extractText(offer.vendor) || '',
    category: categoryName,
    description: customDescriptions[vendorCode] || cleanDescription(description),
    pictures,
    params,

    // Ціна та наявність
    available,
    price: Math.round(parseFloat(offer.price) || 0),
    oldPrice: (offer.oldprice || offer.old_price || offer.price_old) 
      ? Math.round(parseFloat(offer.oldprice || offer.old_price || offer.price_old)) 
      : null,

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
    lines.push(`      <id>${escapeXml(o.code)}</id>`);
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
          const values = String(p.value).split('|').map(v => v.trim()).filter(Boolean);
          for (const val of values) {
            lines.push(`        <param name="${escapeXml(p.name)}">${escapeXml(val)}</param>`);
          }
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
    let rawOffersSlice = rawOffers;
    if (CONFIG.maxProducts > 0) {
      rawOffersSlice = rawOffers.slice(0, CONFIG.maxProducts);
      console.log(`   ⚠️  Ліміт тесту: перші ${CONFIG.maxProducts} товарів з ${rawOffers.length}`);
    }
    
    const catalog = [];
    const validOffers = [];
    
    for (const raw of rawOffersSlice) {
      const o = transformOffer(raw);
      
      // Зберігаємо товар в загальний каталог для адмін-панелі
      catalog.push({
        id: o.id,
        vendorCode: o.vendorCode,
        name: o.name,
        price: o.price,
        oldPrice: o.oldPrice,
        picture: o.pictures.length > 0 ? o.pictures[0] : null,
        category: o.category,
        description: o.description
      });

      // Фільтрація по whitelist (якщо він не порожній)
      if (whitelist && whitelist.length > 0 && !whitelist.includes(o.vendorCode)) {
        continue;
      }

      validOffers.push(o);
    }
    
    const offers = validOffers;
    const availableCount = offers.filter((o) => o.available).length;
    console.log(`   В наявності: ${availableCount} / ${offers.length}`);

    // 4. Генерація файлів
    const productsXml = generateProductsXml(offers);
    const pricesJson = generatePricesJson(offers);

    // 5. Збереження
    const productsPath = path.join(FEEDS_DIR, 'products.xml');
    const pricesPath = path.join(FEEDS_DIR, 'prices.json');
    const catalogPath = path.join(FEEDS_DIR, 'catalog.json');

    fs.writeFileSync(productsPath, productsXml, 'utf-8');
    fs.writeFileSync(pricesPath, pricesJson, 'utf-8');
    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf-8');

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
