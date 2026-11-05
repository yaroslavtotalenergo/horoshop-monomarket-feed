export const REPO_OWNER = 'yaroslavtotalenergo';
export const REPO_NAME = 'horoshop-monomarket-feed';
export const FEED_URLS = {
  xml: `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/feeds/products.xml`,
  json: `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/feeds/prices.json`,
  horoshop: `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/feeds/horoshop-monobank.xml`,
};

export const STORED_LOGIN = 'admin';
export const STORED_PASS_HASH = 'dfb7ab365bc2e031fb610a44224750dad0646f963a18a96ec213160bc0c26e46';

// Simple hash function for password storage
export async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function isHoroshopOutOfStock(product) {
  if (!product) return false;
  if (product.onlyOnProm) return false;
  if (product.horoshopAvailable !== undefined) {
    return product.horoshopAvailable === false || product.horoshopAvailable === 'false';
  }
  return product.available === false || product.available === 'false';
}

export function buildHierarchicalGroups(products) {
  const map = {};
  for (const p of products) {
    const rawCat = p.category || 'Без категорії';
    const parts = rawCat.split(' > ').map(s => s.trim());
    const mainCat = parts[0] || 'Без категорії';
    const subCat = parts.length > 1 ? parts.slice(1).join(' > ') : (parts[0] ? 'Основні товари' : 'Без категорії');

    if (!map[mainCat]) {
      map[mainCat] = {
        main: mainCat,
        products: [],
        subs: {}
      };
    }
    map[mainCat].products.push(p);

    if (!map[mainCat].subs[subCat]) {
      map[mainCat].subs[subCat] = {
        name: subCat,
        fullPath: rawCat,
        products: []
      };
    }
    map[mainCat].subs[subCat].products.push(p);
  }

  return Object.values(map)
    .sort((a, b) => a.main.localeCompare(b.main, 'uk'))
    .map(group => ({
      main: group.main,
      products: group.products,
      subs: Object.values(group.subs).sort((a, b) => a.name.localeCompare(b.name, 'uk'))
    }));
}

export function matchesCategoryFilter(productCategory, filterVal) {
  if (!filterVal || filterVal === 'all') return true;
  const pCat = productCategory || 'Без категорії';
  if (filterVal.startsWith('main:')) {
    const main = filterVal.slice(5).trim();
    return pCat.split(' > ')[0].trim() === main;
  }
  if (filterVal.startsWith('sub:')) {
    const sub = filterVal.slice(4).trim();
    return pCat === sub;
  }
  return pCat === filterVal || pCat.split(' > ')[0].trim() === filterVal;
}

export function getDaysToDispatch(category) {
  if (category && String(category).toLowerCase().includes('комплекти безперебійного живлення')) {
    return 5;
  }
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Kyiv' }));
  const day = now.getDay();
  if (day === 5) return 3; // Friday
  if (day === 6) return 2; // Saturday
  return 1;               // All other days
}

export function isAllowedPromBrand(product) {
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


