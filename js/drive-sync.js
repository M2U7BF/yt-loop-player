// Googleアカウントでログインし、入力履歴をGoogle Driveのアプリ専用領域(appDataFolder)に同期する。
import { loadHistory, saveHistory, MAX_HISTORY } from './history-store.js';
import { historyPanel, renderHistory } from './history-ui.js';

const GOOGLE_CLIENT_ID = '611114130619-45p9qds3g7hht8e36nchabmnv4lhupff.apps.googleusercontent.com';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/youtube.readonly';
const DRIVE_FILE_NAME = 'yt-loop-history.json';
const TOKEN_STORAGE_KEY = 'ytDriveToken';
const PUSH_DEBOUNCE_MS = 1500;

const authButton = document.getElementById('authButton');
const syncStatus = document.getElementById('syncStatus');

let tokenClient = null;
let accessToken = null;
let tokenExpiresAt = 0;
let cachedFileId = null;
let pushTimer = null;
let pendingHistory = null;

function isConfigured() {
  return GOOGLE_CLIENT_ID.indexOf('YOUR_CLIENT_ID') === -1;
}

function loadStoredToken() {
  try {
    const raw = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data && data.accessToken && data.expiresAt > Date.now()) {
      accessToken = data.accessToken;
      tokenExpiresAt = data.expiresAt;
    }
  } catch {
    /* 破損時は未ログイン扱い */
  }
}

function storeToken(token, expiresInSec) {
  accessToken = token;
  tokenExpiresAt = Date.now() + expiresInSec * 1000;
  try {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({ accessToken, expiresAt: tokenExpiresAt }));
  } catch {
    /* 無視 */
  }
}

function clearToken() {
  accessToken = null;
  tokenExpiresAt = 0;
  cachedFileId = null;
  try {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    /* 無視 */
  }
}

function isLoggedIn() {
  return !!accessToken && tokenExpiresAt > Date.now();
}

function updateUi() {
  if (!authButton) return;
  if (isLoggedIn()) {
    authButton.textContent = 'ログアウト';
    if (syncStatus) syncStatus.textContent = '同期中';
  } else {
    authButton.textContent = 'Googleでログイン';
    if (syncStatus) syncStatus.textContent = '未ログイン';
  }
}

async function driveFetch(url, options = {}) {
  options.headers = Object.assign({}, options.headers, { Authorization: `Bearer ${accessToken}` });
  const res = await fetch(url, options);
  if (res.status === 401) {
    clearToken();
    updateUi();
    throw new Error('Google認証の有効期限が切れました。再度ログインしてください。');
  }
  return res;
}

async function findFileId() {
  if (cachedFileId) return cachedFileId;
  const q = encodeURIComponent(`name='${DRIVE_FILE_NAME}'`);
  const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id)`;
  const res = await driveFetch(url);
  const data = await res.json();
  cachedFileId = data.files && data.files[0] ? data.files[0].id : null;
  return cachedFileId;
}

async function downloadHistory(fileId) {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  try {
    const res = await driveFetch(url);
    return await res.json();
  } catch {
    return [];
  }
}

async function createHistoryFile(history) {
  const metadata = { name: DRIVE_FILE_NAME, parents: ['appDataFolder'] };
  const boundary = 'ytloop_boundary';
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    'Content-Type: application/json\r\n\r\n' +
    `${JSON.stringify(history)}\r\n` +
    `--${boundary}--`;
  const res = await driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  const data = await res.json();
  cachedFileId = data.id;
  return cachedFileId;
}

function updateHistoryFile(fileId, history) {
  return driveFetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(history),
  });
}

async function pushNow(history) {
  try {
    const fileId = await findFileId();
    if (fileId) {
      await updateHistoryFile(fileId, history);
    } else {
      await createHistoryFile(history);
    }
  } catch (e) {
    console.warn('[drive-sync] 履歴の同期に失敗しました', e);
  }
}

/** ローカルとクラウドの履歴をurlで重複排除しつつマージする（updatedAtが新しい方を優先）。 */
function mergeHistories(local, cloud) {
  const map = {};
  [...(cloud || []), ...(local || [])].forEach((item) => {
    if (!item || !item.url) return;
    const existing = map[item.url];
    if (!existing || (item.updatedAt || 0) > (existing.updatedAt || 0)) {
      map[item.url] = item;
    }
  });
  return Object.values(map)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, MAX_HISTORY);
}

async function pullAndMerge() {
  try {
    const fileId = await findFileId();
    if (!fileId) {
      // クラウド側に履歴ファイルがまだない場合はローカルの履歴をそのままアップロード
      await pushNow(loadHistory());
      return;
    }
    const cloudHistory = await downloadHistory(fileId);
    const merged = mergeHistories(loadHistory(), cloudHistory);
    saveHistory(merged);
    // 履歴パネルを開いている最中だけ表示を更新する（ログイン直後に勝手に開かないようにする）
    if (!historyPanel.classList.contains('hidden')) renderHistory();
  } catch (e) {
    console.warn('[drive-sync] 履歴の取得に失敗しました', e);
  }
}

function push(history) {
  if (!isLoggedIn()) return;
  pendingHistory = history;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    pushNow(pendingHistory);
  }, PUSH_DEBOUNCE_MS);
}

function login() {
  if (!isConfigured()) {
    alert('Google連携が未設定です。README記載のセットアップ手順を確認してください。');
    console.warn('[drive-sync] GOOGLE_CLIENT_IDが未設定のためログインできません。');
    return;
  }
  if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
    alert('Googleログインの読み込みに失敗しました。しばらくしてから再度お試しください。');
    console.warn('[drive-sync] Google Identity Servicesがまだ読み込まれていません。');
    return;
  }
  if (!tokenClient) {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPE,
      callback: (response) => {
        if (response.error) {
          console.warn('[drive-sync] ログインに失敗しました', response);
          return;
        }
        storeToken(response.access_token, response.expires_in);
        updateUi();
        pullAndMerge();
      },
    });
  }
  tokenClient.requestAccessToken();
}

function logout() {
  if (accessToken && window.google && google.accounts && google.accounts.oauth2) {
    google.accounts.oauth2.revoke(accessToken, () => {
      /* no-op */
    });
  }
  clearToken();
  updateUi();
}

if (authButton) {
  authButton.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isLoggedIn()) {
      logout();
    } else {
      login();
    }
  });
}

loadStoredToken();
updateUi();
if (isLoggedIn()) {
  pullAndMerge();
}

window.driveSync = {
  login,
  logout,
  push,
  isLoggedIn,
  getAccessToken: () => (isLoggedIn() ? accessToken : null),
};
