const axios = require('axios');

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegram(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN || TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn('⚠️ Telegram сповіщення пропущено: TELEGRAM_BOT_TOKEN або TELEGRAM_CHAT_ID не задано в env/secrets.');
    return;
  }
  try {
    const res = await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });
    console.log(`✅ Telegram сповіщення успішно надіслано (HTTP ${res.status})`);
    return res.data;
  } catch (e) {
    console.error('❌ Не вдалось відправити Telegram-сповіщення:', e.response?.data?.description || e.message);
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
