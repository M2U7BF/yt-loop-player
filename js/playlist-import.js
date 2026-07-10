// Googleアカウントの自分のYouTubeプレイリストから、動画URLを履歴にインポートする。
(function () {
  var YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

  var importButton = document.getElementById('importPlaylistButton');
  var panel = document.getElementById('playlistImportPanel');
  var backdrop = document.getElementById('playlistImportBackdrop');
  var closeButton = document.getElementById('playlistImportClose');
  var statusEl = document.getElementById('playlistImportStatus');
  var listEl = document.getElementById('playlistImportList');

  function ytFetch(url) {
    var token = window.driveSync && window.driveSync.getAccessToken();
    if (!token) return Promise.reject(new Error('未ログインです'));
    return fetch(url, { headers: { Authorization: 'Bearer ' + token } }).then(function (res) {
      if (!res.ok) {
        return res.json().catch(function () { return null; }).then(function (body) {
          var message = (body && body.error && body.error.message) || res.statusText;
          throw new Error(message);
        });
      }
      return res.json();
    });
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text || '';
  }

  function openPanel() {
    if (panel) panel.classList.remove('hidden');
  }

  function closePanel() {
    if (panel) panel.classList.add('hidden');
  }

  // 自分のプレイリストを全件取得（ページネーション対応）
  function fetchAllPlaylists() {
    var playlists = [];
    function loadPage(pageToken) {
      var url = YOUTUBE_API_BASE + '/playlists?part=snippet,contentDetails&mine=true&maxResults=50' +
        (pageToken ? '&pageToken=' + pageToken : '');
      return ytFetch(url).then(function (data) {
        playlists = playlists.concat(data.items || []);
        if (data.nextPageToken) return loadPage(data.nextPageToken);
        return playlists;
      });
    }
    return loadPage();
  }

  // 指定プレイリストの動画を全件取得（ページネーション対応）
  function fetchAllPlaylistItems(playlistId) {
    var items = [];
    function loadPage(pageToken) {
      var url = YOUTUBE_API_BASE + '/playlistItems?part=snippet&playlistId=' + encodeURIComponent(playlistId) +
        '&maxResults=50' + (pageToken ? '&pageToken=' + pageToken : '');
      return ytFetch(url).then(function (data) {
        items = items.concat(data.items || []);
        if (data.nextPageToken) return loadPage(data.nextPageToken);
        return items;
      });
    }
    return loadPage();
  }

  function renderPlaylists(playlists) {
    listEl.innerHTML = '';
    if (playlists.length === 0) {
      var empty = document.createElement('li');
      empty.className = 'playlist-import-empty';
      empty.textContent = 'プレイリストが見つかりません';
      listEl.appendChild(empty);
      return;
    }
    playlists.forEach(function (playlist) {
      var li = document.createElement('li');
      li.className = 'playlist-import-item';
      var count = playlist.contentDetails ? playlist.contentDetails.itemCount : null;
      li.textContent = playlist.snippet.title + (count != null ? '（' + count + '件）' : '');
      li.addEventListener('click', function () {
        importPlaylist(playlist.id, playlist.snippet.title);
      });
      listEl.appendChild(li);
    });
  }

  // プレイリスト内動画のURLをクエリパラメータなしの形式で履歴に追加する
  function importPlaylist(playlistId, playlistTitle) {
    listEl.innerHTML = '';
    setStatus(playlistTitle + ' を読み込み中...');
    fetchAllPlaylistItems(playlistId).then(function (items) {
      var history = loadHistory();
      var added = 0;
      items.forEach(function (item) {
        var videoId = item.snippet && item.snippet.resourceId && item.snippet.resourceId.videoId;
        if (!videoId) return;
        var url = 'https://www.youtube.com/watch?v=' + videoId;
        var title = item.snippet.title;
        history = history.filter(function (h) { return h.url !== url; });
        history.unshift({ url: url, title: title, updatedAt: Date.now() });
        added++;
      });
      history = history.slice(0, MAX_HISTORY);
      saveHistory(history);
      setStatus(added + '件インポートしました');
      setTimeout(function () {
        closePanel();
        renderHistory();
      }, 800);
    }).catch(function (e) {
      console.warn('[playlist-import] インポートに失敗しました', e);
      setStatus('インポートに失敗しました: ' + e.message);
    });
  }

  function openImport() {
    if (!window.driveSync || !window.driveSync.isLoggedIn()) {
      alert('プレイリストをインポートするにはGoogleログインが必要です。');
      return;
    }
    if (window.settingsPanel) window.settingsPanel.close();
    listEl.innerHTML = '';
    openPanel();
    setStatus('プレイリストを取得中...');
    fetchAllPlaylists().then(function (playlists) {
      setStatus('');
      renderPlaylists(playlists);
    }).catch(function (e) {
      console.warn('[playlist-import] プレイリスト取得に失敗しました', e);
      setStatus('プレイリストの取得に失敗しました: ' + e.message);
    });
  }

  if (importButton) {
    importButton.addEventListener('click', function (e) {
      e.stopPropagation();
      openImport();
    });
  }
  if (closeButton) {
    closeButton.addEventListener('click', function (e) {
      e.stopPropagation();
      closePanel();
    });
  }
  if (backdrop) {
    backdrop.addEventListener('click', function (e) {
      e.stopPropagation();
      closePanel();
    });
  }
})();
