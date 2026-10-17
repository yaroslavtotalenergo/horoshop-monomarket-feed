const axios = require('axios');
const fs = require('fs');
const path = require('path');

function getCredentials() {
  let token = process.env.TELEGRAM_BOT_TOKEN;
  let chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    try {
      const runtimePath = path.join(__dirname, '..', '.tg-runtime.json');
      if (fs.existsSync(runtimePath)) {
        const data = JSON.parse(fs.readFileSync(runtimePath, 'utf8'));
        token = token || data.token;
        chatId = chatId || data.chatId;
      }
    } catch (_) { }
  }
  return { token, chatId };
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function sendTelegram(message) {
  const { token, chatId } = getCredentials();
  if (!token || !chatId) {
    console.warn('⚠️ Telegram сповіщення пропущено: TELEGRAM_BOT_TOKEN або TELEGRAM_CHAT_ID не задано в env/secrets.');
    return;
  }
  try {
    const res = await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });
    console.log(`✅ Telegram сповіщення успішно надіслано (HTTP ${res.status})`);
    return res.data;
  } catch (e) {
    console.error('❌ Не вдалось відправити Telegram-сповіщення:', e.response?.data?.description || e.message);
  }
}

async function notifyError(title, details) {
  const safeTitle = escapeHtml(title);
  const safeDetails = escapeHtml(details);
  const msg = `🚨 <b>Помилка синхронізації</b>\n\n` +
    `⚠️ <b>${safeTitle}</b>\n\n` +
    (safeDetails ? `📋 <code>${safeDetails.slice(0, 3500)}</code>` : '');
  await sendTelegram(msg);
}

async function notifySuccess(updatedCount, warnings) {
  let msg = `✅ <b>Залишки синхронізовано</b>\n\n` +
    `📦 Оновлено товарів: <b>${updatedCount}</b>`;
  if (warnings && warnings.length > 0) {
    msg += `\n\n⚠️ <b>Попередження:</b>\n` + warnings.map(w => `• ${escapeHtml(w)}`).join('\n');
  }
  await sendTelegram(msg);
}

module.exports = { notifyError, notifySuccess, sendTelegram, escapeHtml };

