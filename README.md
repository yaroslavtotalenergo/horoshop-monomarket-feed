# Horoshop → Monomarket Feed Converter

Автоматичний конвертер XML-фіду Хорошопу у два формати для Мономаркет:
- **`feeds/products.xml`** — Товарний фід (формат `<Market>`)
- **`feeds/prices.json`** — Прайс-лист (JSON, оновлюється кожні 30 хв)

---

## Як це працює

```
Хорошоп XML (ваш фід) 
    → GitHub Actions (кожні 30 хвилин)
        → feeds/products.xml  (товарний фід для Мономаркет)
        → feeds/prices.json   (прайс-лист для Мономаркет)
            → GitHub Pages (публічний URL)
                → Мономаркет читає файли
```

---

## Налаштування

### 1. Зробіть Fork або клонуйте цей репозиторій

### 2. Знайдіть URL вашого Хорошоп XML-фіду

У адмінпанелі Хорошопу: **Маркетинг → Прайс-листи / Фіди** або **Налаштування → Інтеграції**.

Має бути щось на кшталт:
```
https://your-shop.horoshop.ua/sitemap.xml
https://your-shop.horoshop.ua/export/pricelist.xml
```

### 3. Додайте Secret у GitHub

GitHub → ваш репозиторій → **Settings → Secrets and variables → Actions → Secrets**

| Secret name | Значення |
|-------------|---------|
| `HOROSHOP_FEED_URL` | URL вашого XML-фіду з Хорошопу |

### 4. Налаштуйте Variables (опційно)

GitHub → Settings → Secrets and variables → Actions → **Variables**

| Variable | За замовчуванням | Опис |
|----------|-----------------|------|
| `DEFAULT_STOCK` | `10` | Фіксований залишок для всіх товарів |
| `WAREHOUSE_ID` | `main` | ID складу (латиниця, без / та \\) |
| `WARRANTY_TYPE` | `no` | Тип гарантії: `no`, `manufacturer`, `merchant` |
| `WARRANTY_PERIOD` | `0` | Гарантія в місяцях |
| `MAX_PAY_IN_PARTS` | `6` | Макс. платежів частинами |
| `DAYS_TO_DISPATCH` | `1` | Днів до відправки |
| `SHOP_NAME` | `Магазин` | Назва магазину |

### 5. Увімкніть GitHub Pages

GitHub → Settings → Pages → **Source: Deploy from branch** → Branch: `main` → Folder: `/feeds` → Save

Ваші файли будуть доступні за адресою:
```
https://your-username.github.io/horoshop-monomarket-feed/products.xml
https://your-username.github.io/horoshop-monomarket-feed/prices.json
```

> **Альтернатива:** Якщо GitHub Pages не влаштовує — використовуйте `raw.githubusercontent.com`:
> ```
> https://raw.githubusercontent.com/your-username/horoshop-monomarket-feed/main/feeds/prices.json
> ```

### 6. Перший запуск

Перейдіть у **Actions → Update Monomarket Feeds → Run workflow** для ручного запуску.

### 7. Передайте URL Мономаркету

- **Прайс-лист:** `https://your-username.github.io/horoshop-monomarket-feed/prices.json`
- **Товарний фід:** `https://your-username.github.io/horoshop-monomarket-feed/products.xml`

---

## Локальне тестування

```bash
# Встановити залежності
npm install

# Тест з локальним файлом
LOCAL_FEED_PATH=./test/horoshop-sample.xml node src/convert.js

# Або з URL
HOROSHOP_FEED_URL=https://your-shop.com/export.xml node src/convert.js
```

---

## Штрихкод (barcode)

Мономаркет вимагає штрихкод. Скрипт шукає його серед `<param>` з такими назвами:
- `Штрихкод`, `Баркод`, `Barcode`, `EAN`, `GTIN`, `UPC`

Якщо у вас інша назва — відредагуйте масив `barcodeParamNames` у `src/convert.js`.

---

## Структура репозиторію

```
├── .github/
│   └── workflows/
│       └── update-feeds.yml   ← GitHub Actions (cron 30 хв)
├── src/
│   └── convert.js             ← Основний конвертер
├── feeds/                     ← Згенеровані файли (auto)
│   ├── products.xml
│   └── prices.json
├── .env.example               ← Шаблон змінних середовища
└── package.json
```
