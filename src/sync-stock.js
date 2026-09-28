const axios = require('axios');
const { parse } = require('csv-parse/sync');
const fs = require('fs');

async function main() {
  console.log('🚀 Синхронізація залишків з Google Sheets...');

  let config = { sheets: [] };
  try {
    config = JSON.parse(fs.readFileSync('src/google-sheets.json', 'utf8'));
  } catch (e) {
    console.error('Файл src/google-sheets.json не знайдено, пропускаємо.');
    return;
  }

  let stockOverrides = {};
  try { stockOverrides = JSON.parse(fs.readFileSync('src/stock.json', 'utf8')); } catch (e) { }

  let availabilityOverrides = {};
  try { availabilityOverrides = JSON.parse(fs.readFileSync('src/availability.json', 'utf8')); } catch (e) { }

  const keywords = {
    article: ['артикул', 'артікул', 'vendor code', 'vendor_code'],
    warehouses: ['ридомиль', 'в.олександівка 1', 'в.олександівка 2', 'с.борщагівка']
  };

  let updatedCount = 0;

  for (const sheetUrl of config.sheets) {
    if (!sheetUrl) continue;
    
    let exportUrl = sheetUrl;
    if (exportUrl.includes('/edit')) {
      exportUrl = exportUrl.replace(/\/edit.*/, '/export?format=csv');
    }
    
    console.log(`📥 Завантаження: ${exportUrl}`);
    
    try {
      const res = await axios.get(exportUrl);
      const csvData = res.data;
      
      const rows = parse(csvData, {
        skip_empty_lines: true,
        relax_column_count: true
      });
      
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
        console.warn('⚠️ Колонку "Артикул" не знайдено у перших 20 рядках цієї таблиці.');
        continue;
      }
      
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
      }
      
    } catch (e) {
      console.error(`❌ Помилка обробки ${exportUrl}: ${e.message}`);
    }
  }

  fs.writeFileSync('src/stock.json', JSON.stringify(stockOverrides, null, 2), 'utf8');
  fs.writeFileSync('src/availability.json', JSON.stringify(availabilityOverrides, null, 2), 'utf8');
  
  console.log(`✅ Синхронізацію завершено! Оновлено/перевірено ${updatedCount} товарів.`);
}

main();
