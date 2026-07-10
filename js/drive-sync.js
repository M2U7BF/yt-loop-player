// Googleアカウントでログインし、入力履歴をGoogle Driveのアプリ専用領域(appDataFolder)に同期する。
(function () {
  var GOOGLE_CLIENT_ID = '611114130619-45p9qds3g7hht8e36nchabmnv4lhupff.apps.googleusercontent.com';
  var SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
  var DRIVE_FILE_NAME = 'yt-loop-history.json';
  var TOKEN_STORAGE_KEY = 'ytDriveToken';
  var AUTO_LOGIN_STORAGE_KEY = 'ytDriveAutoLogin';
  var PUSH_DEBOUNCE_MS = 1500;
  var REFRESH_MARGIN_MS = 60 * 1000; // 有効期限切れの60秒前に自動更新する
  var GIS_WAIT_INTERVAL_MS = 250;
  var GIS_WAIT_MAX_RETRIES = 20;

  var authButton = document.getElementById('authButton');
  var syncStatus = document.getElementById('syncStatus');

  var tokenClient = null;
  var accessToken = null;
  var tokenExpiresAt = 0;
  var cachedFileId = null;
  var pushTimer = null;
  var pendingHistory = null;
  var refreshTimer = null;

  function isConfigured() {
    return GOOGLE_CLIENT_ID.indexOf('YOUR_CLIENT_ID') === -1;
  }

  function loadStoredToken() {
    try {
      var raw = sessionStorage.getItem(TOKEN_STORAGE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (data && data.accessToken && data.expiresAt > Date.now()) {
        accessToken = data.accessToken;
        tokenExpiresAt = data.expiresAt;
      }
    } catch (e) { /* 破損時は未ログイン扱い */ }
  }

  function storeToken(token, expiresInSec) {
    accessToken = token;
    tokenExpiresAt = Date.now() + expiresInSec * 1000;
    try {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({ accessToken: accessToken, expiresAt: tokenExpiresAt }));
    } catch (e) { /* 無視 */ }
    markConsented();
    scheduleRefresh();
  }

  function clearToken() {
    accessToken = null;
    tokenExpiresAt = 0;
    cachedFileId = null;
    try { sessionStorage.removeItem(TOKEN_STORAGE_KEY); } catch (e) { /* 無視 */ }
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
  }

  function isLoggedIn() {
    return !!accessToken && tokenExpiresAt > Date.now();
  }

  // 一度ログインに成功したことをlocalStorageに記録する（ブラウザを閉じても消えない）。
  // 次回訪問時、この記録があればGoogle側のセッションを使ったサイレント再ログインを試みる。
  function hasConsentedBefore() {
    try { return localStorage.getItem(AUTO_LOGIN_STORAGE_KEY) === 'true'; } catch (e) { return false; }
  }

  function markConsented() {
    try { localStorage.setItem(AUTO_LOGIN_STORAGE_KEY, 'true'); } catch (e) { /* 無視 */ }
  }

  function clearConsent() {
    try { localStorage.removeItem(AUTO_LOGIN_STORAGE_KEY); } catch (e) { /* 無視 */ }
  }

  // アクセストークンの有効期限が切れる前に、ユーザー操作なしで更新を試みる。
  function scheduleRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer);
    var delay = Math.max(0, tokenExpiresAt - Date.now() - REFRESH_MARGIN_MS);
    refreshTimer = setTimeout(function () {
      requestToken(true);
    }, delay);
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

  function driveFetch(url, options) {
    options = options || {};
    options.headers = Object.assign({}, options.headers, { Authorization: 'Bearer ' + accessToken });
    return fetch(url, options).then(function (res) {
      if (res.status === 401) {
        clearToken();
        updateUi();
        throw new Error('Google認証の有効期限が切れました。再度ログインしてください。');
      }
      return res;
    });
  }

  function findFileId() {
    if (cachedFileId) return Promise.resolve(cachedFileId);
    var q = encodeURIComponent("name='" + DRIVE_FILE_NAME + "'");
    var url = 'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=' + q + '&fields=files(id)';
    return driveFetch(url).then(function (res) { return res.json(); }).then(function (data) {
      cachedFileId = (data.files && data.files[0]) ? data.files[0].id : null;
      return cachedFileId;
    });
  }

  function downloadHistory(fileId) {
    var url = 'https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media';
    return driveFetch(url).then(function (res) { return res.json(); }).catch(function () { return []; });
  }

  function createHistoryFile(history) {
    var metadata = { name: DRIVE_FILE_NAME, parents: ['appDataFolder'] };
    var boundary = 'ytloop_boundary';
    var body =
      '--' + boundary + '\r\n' +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) + '\r\n' +
      '--' + boundary + '\r\n' +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(history) + '\r\n' +
      '--' + boundary + '--';
    return driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/related; boundary=' + boundary },
      body: body
    }).then(function (res) { return res.json(); }).then(function (data) {
      cachedFileId = data.id;
      return cachedFileId;
    });
  }

  function updateHistoryFile(fileId, history) {
    return driveFetch('https://www.googleapis.com/upload/drive/v3/files/' + fileId + '?uploadType=media', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(history)
    });
  }

  function pushNow(history) {
    return findFileId().then(function (fileId) {
      if (fileId) return updateHistoryFile(fileId, history);
      return createHistoryFile(history);
    }).catch(function (e) {
      console.warn('[drive-sync] 履歴の同期に失敗しました', e);
    });
  }

  // ローカルとクラウドの履歴をurlで重複排除しつつマージする（updatedAtが新しい方を優先）
  function mergeHistories(local, cloud) {
    var map = {};
    (cloud || []).concat(local || []).forEach(function (item) {
      if (!item || !item.url) return;
      var existing = map[item.url];
      if (!existing || (item.updatedAt || 0) > (existing.updatedAt || 0)) {
        map[item.url] = item;
      }
    });
    return Object.keys(map)
      .map(function (url) { return map[url]; })
      .sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); })
      .slice(0, MAX_HISTORY);
  }

  function pullAndMerge() {
    findFileId().then(function (fileId) {
      if (!fileId) {
        // クラウド側に履歴ファイルがまだない場合はローカルの履歴をそのままアップロード
        return pushNow(loadHistory());
      }
      return downloadHistory(fileId).then(function (cloudHistory) {
        var merged = mergeHistories(loadHistory(), cloudHistory);
        saveHistory(merged);
        // 履歴パネルを開いている最中だけ表示を更新する（ログイン直後に勝手に開かないようにする）
        if (!historyPanel.classList.contains('hidden')) renderHistory();
      });
    }).catch(function (e) {
      console.warn('[drive-sync] 履歴の取得に失敗しました', e);
    });
  }

  function push(history) {
    if (!isLoggedIn()) return;
    pendingHistory = history;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      pushTimer = null;
      pushNow(pendingHistory);
    }, PUSH_DEBOUNCE_MS);
  }

  // silent=trueの場合、ポップアップやアカウント選択UIを出さずに、
  // ブラウザに残っているGoogleのログインセッションを使ってトークン取得のみを試みる。
  // ユーザーがGoogleに未ログイン、もしくは同意が無効化されている場合は何も起きず失敗する。
  function requestToken(silent) {
    if (!isConfigured()) {
      if (!silent) {
        alert('Google連携が未設定です。README記載のセットアップ手順を確認してください。');
        console.warn('[drive-sync] GOOGLE_CLIENT_IDが未設定のためログインできません。');
      }
      return;
    }
    if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
      if (!silent) {
        alert('Googleログインの読み込みに失敗しました。しばらくしてから再度お試しください。');
        console.warn('[drive-sync] Google Identity Servicesがまだ読み込まれていません。');
      }
      return;
    }
    if (!tokenClient) {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPE,
        callback: function (response) {
          if (response.error) {
            console.warn('[drive-sync] ログインに失敗しました', response);
            return;
          }
          storeToken(response.access_token, response.expires_in);
          updateUi();
          pullAndMerge();
        }
      });
    }
    tokenClient.requestAccessToken(silent ? { prompt: '' } : {});
  }

  function login() {
    requestToken(false);
  }

  // 過去にログイン済みの記録があれば、ページ表示時に自動でサイレントログインを試みる。
  function trySilentLogin() {
    if (isLoggedIn() || !hasConsentedBefore()) return;
    requestToken(true);
  }

  // GIS(Google Identity Services)はasync/deferで読み込まれるため、
  // 読み込み完了を待ってからサイレントログインを試みる。
  function waitForGisAndTrySilentLogin(retriesLeft) {
    if (typeof retriesLeft === 'undefined') retriesLeft = GIS_WAIT_MAX_RETRIES;
    if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
      trySilentLogin();
      return;
    }
    if (retriesLeft <= 0) return;
    setTimeout(function () { waitForGisAndTrySilentLogin(retriesLeft - 1); }, GIS_WAIT_INTERVAL_MS);
  }

  function logout() {
    if (accessToken && window.google && google.accounts && google.accounts.oauth2) {
      google.accounts.oauth2.revoke(accessToken, function () { /* no-op */ });
    }
    clearToken();
    clearConsent();
    updateUi();
  }

  if (authButton) {
    authButton.addEventListener('click', function (e) {
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
    scheduleRefresh();
    pullAndMerge();
  } else {
    waitForGisAndTrySilentLogin();
  }

  window.driveSync = {
    login: login,
    logout: logout,
    push: push,
    isLoggedIn: isLoggedIn
  };
})();
