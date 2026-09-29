const axios = require('axios');

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegram(message) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'HTML'
    });
  } catch (e) {
    console.error('❌ Не вдалось відправити Telegram-сповіщення:', e.message);
  }
}

async function notifyError(title, details) {
  const msg = `🚨 <b>Помилка синхронізації залишків</b>\n\n` +
    `⚠️ <b>${title}</b>\n\n` +
    (details ? `📋 ${details}` : '');
  await sendTelegram(msg);
}

async function notifySuccess(updatedCount, warnings) {
  let msg = `✅ <b>Залишки синхронізовано</b>\n\n` +
    `📦 Оновлено товарів: <b>${updatedCount}</b>`;
  if (warnings && warnings.length > 0) {
    msg += `\n\n⚠️ <b>Попередження:</b>\n` + warnings.map(w => `• ${w}`).join('\n');
  }
  await sendTelegram(msg);
}

module.exports = { notifyError, notifySuccess, sendTelegram };
