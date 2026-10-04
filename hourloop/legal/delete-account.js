// delete-account.js — удаление аккаунта Hourloop (сайт и возврат VK ID)
// Реализовано в рамках задачи 142 (04.10.2026). Без внешних библиотек и SDK.

// ---------------------------------------------------------------------------
// Константы
// ---------------------------------------------------------------------------

// Адрес API сервера кошелька (совпадает с RewardManager.API_BASE в игре)
const API = "https://d5dvuhq90hqhsslnnrrr.nm0huug4.apigw.yandexcloud.net";

// Идентификатор веб-приложения VK ID из кабинета разработчика VK
const VK_APP = "54793433";

// Доверенный адрес возврата веб-приложения VK ID
const VK_REDIRECT = "https://nemedistudio.online/hourloop/vkid/callback.html";

// Основной домен сайта без www
const SITE = "https://nemedistudio.online";

// ---------------------------------------------------------------------------
// Перенаправление с www на канонический адрес без www
// ---------------------------------------------------------------------------
if (typeof window !== "undefined" && window.location && window.location.hostname === "www.nemedistudio.online") {
  window.location.replace(SITE + window.location.pathname + window.location.search + window.location.hash);
}

// ---------------------------------------------------------------------------
// Словари текстов интерфейса (RU и EN)
// ---------------------------------------------------------------------------
const TEXTS = {
  ru: {
    success: "Аккаунт удалён. Все его данные стёрты с сервера. Если игра установлена, при следующем запуске она начнёт новый гостевой профиль. Прогресс на телефоне стирается кнопкой «Сбросить прогресс» в настройках игры.",
    no_connection: "Нет связи с сервером. Попробуйте позже.",
    invalid_email: "Похоже, в адресе ошибка.",
    not_linked_email: "К этой почте не привязан ни один аккаунт Hourloop. Аккаунт без привязки удаляется в игре или письмом в поддержку — способы ниже.",
    not_linked_vk: "К этому VK ID не привязан ни один аккаунт Hourloop. Аккаунт без привязки удаляется в игре или письмом в поддержку — способы ниже.",
    too_soon: "Новый код можно запросить через %d с.",
    daily_limit: "Слишком много писем за сегодня. Попробуйте завтра.",
    mail_failed: "Не удалось отправить письмо. Попробуйте через минуту.",
    invalid_code_attempts: "Неверный код. Осталось попыток: %d.",
    invalid_code: "Код — 6 цифр из письма.",
    code_expired: "Код устарел. Запросите новый.",
    too_many_attempts: "Слишком много попыток. Запросите новый код.",
    vk_exchange_failed: "VK ID не подтвердил вход. Попробуйте ещё раз.",
    other_error: "Ошибка (%s). Попробуйте позже или напишите в поддержку.",
    waiting: "Подождите…",
    code_sent: "Код отправлен на %s. Он действует %d минут.",
    resend_countdown: "Получить код (%d с)",
    get_code_btn: "Получить код",
    vk_canceled: "Вход через VK ID отменён.",
    session_expired: "Сессия входа устарела или открыта в другой вкладке. Начните заново.",
    consent_required: "Сначала отметьте согласие выше.",
    return_link: "← Вернуться на страницу удаления",
    callback_title: "Удаление аккаунта Hourloop"
  },
  en: {
    success: "Account deleted. All of its data has been erased from the server. If the game is installed, it will start a new guest profile on next launch. Progress on your phone can be cleared using the \"Reset Progress\" button in game settings.",
    no_connection: "No connection to the server. Please try again later.",
    invalid_email: "Invalid email address.",
    not_linked_email: "No Hourloop account is linked to this email address. An unlinked account can be deleted inside the game or by emailing support — see methods below.",
    not_linked_vk: "No Hourloop account is linked to this VK ID. An unlinked account can be deleted inside the game or by emailing support — see methods below.",
    too_soon: "A new code can be requested in %d s.",
    daily_limit: "Too many emails sent today. Please try again tomorrow.",
    mail_failed: "Failed to send email. Please try again in a minute.",
    invalid_code_attempts: "Invalid code. Attempts remaining: %d.",
    invalid_code: "The code must be 6 digits from the email.",
    code_expired: "Code expired. Please request a new one.",
    too_many_attempts: "Too many attempts. Please request a new code.",
    vk_exchange_failed: "VK ID failed to authenticate. Please try again.",
    other_error: "Error (%s). Please try again later or contact support.",
    waiting: "Please wait…",
    code_sent: "Code sent to %s. It is valid for %d minutes.",
    resend_countdown: "Get code (%d s)",
    get_code_btn: "Get code",
    vk_canceled: "VK ID sign-in was canceled.",
    session_expired: "Sign-in session has expired or was opened in another tab. Please start over.",
    consent_required: "Please tick the consent box above first.",
    return_link: "← Return to account deletion page",
    callback_title: "Hourloop Account Deletion"
  }
};

// ---------------------------------------------------------------------------
// Вспомогательные функции
// ---------------------------------------------------------------------------

function format(template, ...args) {
  let i = 0;
  return template.replace(/%[ds]/g, () => (args[i] !== undefined ? args[i++] : ""));
}

// Генерация криптографически стойкой строки нужной длины из алфавита A-Z a-z 0-9 - _
function generateRandomString(len) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let result = "";
  for (let i = 0; i < len; i++) {
    result += chars[bytes[i] & 63];
  }
  return result;
}

// Вычисление code_challenge по алгоритму S256: BASE64URL(SHA-256(ASCII(verifier))) без '='
async function computeCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Сетевой запрос fetch с таймаутом 20 с без передачи токенов или учетных данных
async function postJson(endpoint, payload) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(API + endpoint, {
      method: "POST",
      credentials: "omit",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.status === 200 || response.status === 400) {
      const data = await response.json();
      return { ok: response.status === 200, status: response.status, data };
    }
    return { ok: false, status: response.status, error: "bad_status" };
  } catch (err) {
    clearTimeout(timeoutId);
    return { ok: false, status: 0, error: "network" };
  }
}

// ---------------------------------------------------------------------------
// Инициализация страницы удаления (delete-account-*.html)
// ---------------------------------------------------------------------------
function initDeletePage() {
  const deleteSection = document.getElementById("hl-delete-section");
  if (!deleteSection) return;

  const lang = (document.documentElement.lang || "ru").toLowerCase().startsWith("en") ? "en" : "ru";
  const t = TEXTS[lang] || TEXTS.ru;

  const consentCheck = document.getElementById("hl-consent-check");
  const vkBtn = document.getElementById("hl-vk-btn");
  const emailInput = document.getElementById("hl-email-input");
  const emailCodeBtn = document.getElementById("hl-email-code-btn");
  const codeRow = document.getElementById("hl-code-row");
  const codeInput = document.getElementById("hl-code-input");
  const emailDeleteBtn = document.getElementById("hl-email-delete-btn");
  const statusEl = document.getElementById("hl-status");
  const formBox = document.getElementById("hl-form-box");
  const successBox = document.getElementById("hl-success-box");
  const successText = document.getElementById("hl-success-text");

  const consentWrap = consentCheck ? consentCheck.closest(".hl-consent-wrap") : null;

  let isBusy = false;
  let resendTimer = null;
  let resendSeconds = 0;
  let sentEmail = "";
  let consentFlashTimer = null;
  let consentHintShown = false;

  function setStatus(msg, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = isError ? "hl-status hl-status-error" : "hl-status";
    consentHintShown = false;
  }

  // Кнопки VK ID здесь нет намеренно (задача 143): по требованиям VK к виду кнопки
  // она не бывает неактивной и не бледнеет. Нажатие без флажка разбирает её обработчик.
  function updateButtonsState() {
    const consentGiven = consentCheck && consentCheck.checked;
    if (!consentGiven || isBusy) {
      if (emailCodeBtn) emailCodeBtn.disabled = true;
      if (emailDeleteBtn) emailDeleteBtn.disabled = true;
      return;
    }

    if (emailCodeBtn) emailCodeBtn.disabled = resendSeconds > 0;
    if (emailDeleteBtn) emailDeleteBtn.disabled = false;
  }

  function stopConsentFlash() {
    if (consentFlashTimer) {
      clearTimeout(consentFlashTimer);
      consentFlashTimer = null;
    }
    if (consentWrap) consentWrap.classList.remove("hl-consent-flash");
  }

  // Нажали «Продолжить с VK ID» без флажка: подсказка в строке состояния, фокус на
  // флажок и подсветка блока согласия на 2 секунды.
  function askConsent() {
    setStatus(t.consent_required, true);
    consentHintShown = true;
    if (consentCheck) consentCheck.focus();
    if (!consentWrap) return;
    stopConsentFlash();
    void consentWrap.offsetWidth; // перезапуск анимации при повторном нажатии
    consentWrap.classList.add("hl-consent-flash");
    consentFlashTimer = setTimeout(stopConsentFlash, 2000);
  }

  function startResendCountdown(seconds) {
    if (resendTimer) {
      clearInterval(resendTimer);
      resendTimer = null;
    }
    resendSeconds = Math.max(1, Math.round(seconds));
    if (emailCodeBtn) {
      emailCodeBtn.disabled = true;
      emailCodeBtn.textContent = format(t.resend_countdown, resendSeconds);
    }
    resendTimer = setInterval(() => {
      resendSeconds--;
      if (resendSeconds <= 0) {
        clearInterval(resendTimer);
        resendTimer = null;
        if (emailCodeBtn) {
          emailCodeBtn.textContent = t.get_code_btn;
        }
        updateButtonsState();
      } else if (emailCodeBtn) {
        emailCodeBtn.textContent = format(t.resend_countdown, resendSeconds);
      }
    }, 1000);
  }

  if (consentCheck) {
    consentCheck.addEventListener("change", () => {
      // Флажок поставлен — подсказка про согласие и подсветка больше не нужны.
      if (consentCheck.checked && consentHintShown) {
        setStatus("");
        stopConsentFlash();
      }
      updateButtonsState();
    });
  }

  if (emailCodeBtn) {
    emailCodeBtn.addEventListener("click", async () => {
      if (!consentCheck || !consentCheck.checked || isBusy || resendSeconds > 0) return;

      const email = emailInput ? emailInput.value.trim() : "";
      if (!email.includes("@")) {
        setStatus(t.invalid_email, true);
        if (emailInput) emailInput.focus();
        return;
      }

      isBusy = true;
      updateButtonsState();
      setStatus(t.waiting);

      const res = await postJson("/auth/email_code", {
        email: email,
        purpose: "delete",
        lang: lang
      });

      isBusy = false;
      updateButtonsState();

      if (res.ok && res.data) {
        sentEmail = email;
        if (codeRow) codeRow.style.display = "";
        const hint = res.data.email_hint || email;
        const minutes = Math.round((res.data.expires_in || 900) / 60);
        setStatus(format(t.code_sent, hint, minutes));
        startResendCountdown(res.data.resend_in || 60);
        if (codeInput) codeInput.focus();
      } else if (res.status === 400 && res.data) {
        const err = res.data.error;
        if (err === "too_soon") {
          const wait = res.data.retry_in || 60;
          startResendCountdown(wait);
          setStatus(format(t.too_soon, wait), true);
        } else if (err === "invalid_email") {
          setStatus(t.invalid_email, true);
        } else if (err === "not_linked") {
          setStatus(t.not_linked_email, true);
        } else if (err === "daily_limit") {
          setStatus(t.daily_limit, true);
        } else if (err === "mail_failed") {
          setStatus(t.mail_failed, true);
        } else {
          setStatus(format(t.other_error, err || "bad_request"), true);
        }
      } else {
        setStatus(t.no_connection, true);
      }
    });
  }

  if (emailDeleteBtn) {
    emailDeleteBtn.addEventListener("click", async () => {
      if (!consentCheck || !consentCheck.checked || isBusy) return;

      const code = codeInput ? codeInput.value.trim() : "";
      if (!/^\d{6}$/.test(code)) {
        setStatus(t.invalid_code, true);
        if (codeInput) codeInput.focus();
        return;
      }

      const email = sentEmail || (emailInput ? emailInput.value.trim() : "");
      if (!email.includes("@")) {
        setStatus(t.invalid_email, true);
        return;
      }

      isBusy = true;
      updateButtonsState();
      setStatus(t.waiting);

      const res = await postJson("/account/delete_email", {
        email: email,
        code: code
      });

      isBusy = false;
      updateButtonsState();

      if (res.ok && res.data && res.data.deleted) {
        if (resendTimer) {
          clearInterval(resendTimer);
          resendTimer = null;
        }
        if (formBox) formBox.style.display = "none";
        if (successBox) successBox.style.display = "";
        if (successText) successText.textContent = t.success;
      } else if (res.status === 400 && res.data) {
        const err = res.data.error;
        if (err === "invalid_code") {
          if (res.data.attempts_left !== undefined && res.data.attempts_left !== null) {
            setStatus(format(t.invalid_code_attempts, res.data.attempts_left), true);
          } else {
            setStatus(t.invalid_code, true);
          }
        } else if (err === "code_expired") {
          setStatus(t.code_expired, true);
        } else if (err === "too_many_attempts") {
          setStatus(t.too_many_attempts, true);
        } else if (err === "not_linked") {
          setStatus(t.not_linked_email, true);
        } else if (err === "invalid_email") {
          setStatus(t.invalid_email, true);
        } else {
          setStatus(format(t.other_error, err || "bad_request"), true);
        }
      } else {
        setStatus(t.no_connection, true);
      }
    });
  }

  if (vkBtn) {
    vkBtn.addEventListener("click", async () => {
      // Переход уже идёт — повторные нажатия игнорируются молча.
      if (isBusy) return;
      if (!consentCheck || !consentCheck.checked) {
        askConsent();
        return;
      }

      isBusy = true;
      updateButtonsState();
      setStatus(t.waiting);

      const verifier = generateRandomString(64);
      const state = generateRandomString(43);
      let challenge = "";
      try {
        challenge = await computeCodeChallenge(verifier);
      } catch (e) {
        isBusy = false;
        updateButtonsState();
        setStatus(t.no_connection, true);
        return;
      }

      try {
        sessionStorage.setItem("hl_vk_delete", JSON.stringify({
          v: verifier,
          s: state,
          lang: lang,
          t: Date.now()
        }));
      } catch (e) {
        isBusy = false;
        updateButtonsState();
        setStatus(t.no_connection, true);
        return;
      }

      const langId = lang === "ru" ? "0" : "3";
      const authUrl = "https://id.vk.ru/authorize?" +
        "response_type=code" +
        "&client_id=" + encodeURIComponent(VK_APP) +
        "&redirect_uri=" + encodeURIComponent(VK_REDIRECT) +
        "&state=" + encodeURIComponent(state) +
        "&code_challenge=" + encodeURIComponent(challenge) +
        "&code_challenge_method=S256" +
        "&lang_id=" + langId;

      window.location.assign(authUrl);
    });
  }

  updateButtonsState();

  window.addEventListener("pageshow", () => {
    if (isBusy) {
      isBusy = false;
      setStatus("");
    }
    updateButtonsState();
  });
}

// ---------------------------------------------------------------------------
// Инициализация страницы возврата VK ID (callback.html)
// ---------------------------------------------------------------------------
async function initCallbackPage() {
  const callbackBox = document.getElementById("hl-callback-box");
  if (!callbackBox) return;

  const statusEl = document.getElementById("hl-callback-status");
  const actionEl = document.getElementById("hl-callback-actions");
  const titleEl = document.getElementById("hl-callback-title");

  // Читаем параметры из адреса возврата
  const params = new URLSearchParams(window.location.search);
  let code = params.get("code");
  let state = params.get("state");
  let deviceId = params.get("device_id");
  const error = params.get("error");
  const payload = params.get("payload");

  if (!code && payload) {
    try {
      const p = JSON.parse(payload);
      code = p.code || code;
      state = p.state || state;
      deviceId = p.device_id || deviceId;
    } catch (e) {}
  }

  // Очищаем адресную строку сразу, чтобы код не оставался в истории браузера
  try {
    window.history.replaceState(null, "", window.location.pathname);
  } catch (e) {}

  // Читаем и сразу удаляем сохранённые данные сессии
  let saved = null;
  try {
    const raw = sessionStorage.getItem("hl_vk_delete");
    sessionStorage.removeItem("hl_vk_delete");
    if (raw) saved = JSON.parse(raw);
  } catch (e) {}

  const lang = (saved && saved.lang === "en") ? "en" : "ru";
  const t = TEXTS[lang] || TEXTS.ru;

  if (document.documentElement) {
    document.documentElement.lang = lang;
  }
  if (lang === "en") {
    document.title = "Hourloop Account Deletion — NeMedi";
    document.querySelectorAll("[data-en]").forEach(el => {
      el.textContent = el.getAttribute("data-en");
    });
    document.querySelectorAll("[data-en-href]").forEach(el => {
      el.setAttribute("href", el.getAttribute("data-en-href"));
    });
  } else if (titleEl) {
    titleEl.textContent = t.callback_title;
  }

  function showResult(message, isSuccess = false) {
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.className = isSuccess ? "hl-status hl-status-success" : "hl-status hl-status-error";
    }
    if (actionEl) {
      const page = lang === "en" ? "delete-account-en.html" : "delete-account-ru.html";
      actionEl.innerHTML = `<a href="../legal/${page}" class="btn btn-secondary hl-return-link">${t.return_link}</a>`;
    }
  }

  if (error) {
    showResult(t.vk_canceled, false);
    return;
  }

  const isExpired = !saved || !saved.t || (Date.now() - saved.t > 15 * 60 * 1000);
  const isStateMismatch = !saved || !saved.s || !state || saved.s !== state;
  if (isExpired || isStateMismatch || !saved.v) {
    showResult(t.session_expired, false);
    return;
  }

  if (!code || !deviceId) {
    showResult(t.vk_canceled, false);
    return;
  }

  if (statusEl) {
    statusEl.textContent = t.waiting;
    statusEl.className = "hl-status";
  }

  const res = await postJson("/account/delete_vk", {
    platform: "web",
    code: code,
    code_verifier: saved.v,
    vk_device_id: deviceId,
    redirect_uri: VK_REDIRECT,
    state: state
  });

  if (res.ok && res.data && res.data.deleted) {
    showResult(t.success, true);
  } else if (res.status === 400 && res.data) {
    const err = res.data.error;
    if (err === "not_linked") {
      showResult(t.not_linked_vk, false);
    } else if (err === "vk_exchange_failed") {
      showResult(t.vk_exchange_failed, false);
    } else {
      showResult(format(t.other_error, err || "bad_request"), false);
    }
  } else {
    showResult(t.no_connection, false);
  }
}

// ---------------------------------------------------------------------------
// Запуск логики при загрузке документа
// ---------------------------------------------------------------------------
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initDeletePage();
      initCallbackPage();
    });
  } else {
    initDeletePage();
    initCallbackPage();
  }
}
