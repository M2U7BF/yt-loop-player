// Googleアカウントの自分のYouTubeプレイリストから、動画URLを履歴にインポートする。
import { loadHistory, saveHistory, MAX_HISTORY } from './history-store.js';
import { renderHistory } from './history-ui.js';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

const importButton = document.getElementById('importPlaylistButton');
const panel = document.getElementById('playlistImportPanel');
const backdrop = document.getElementById('playlistImportBackdrop');
const closeButton = document.getElementById('playlistImportClose');
const statusEl = document.getElementById('playlistImportStatus');
const listEl = document.getElementById('playlistImportList');

async function ytFetch(url) {
  const token = window.driveSync && window.driveSync.getAccessToken();
  if (!token) throw new Error('未ログインです');
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = (body && body.error && body.error.message) || res.statusText;
    throw new Error(message);
  }
  return res.json();
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

/** 自分のプレイリストを全件取得（ページネーション対応）。 */
async function fetchAllPlaylists() {
  let playlists = [];
  let pageToken;
  do {
    const url =
      `${YOUTUBE_API_BASE}/playlists?part=snippet,contentDetails&mine=true&maxResults=50` +
      (pageToken ? `&pageToken=${pageToken}` : '');
    const data = await ytFetch(url);
    playlists = playlists.concat(data.items || []);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return playlists;
}

/** 指定プレイリストの動画を全件取得（ページネーション対応）。 */
async function fetchAllPlaylistItems(playlistId) {
  let items = [];
  let pageToken;
  do {
    const url =
      `${YOUTUBE_API_BASE}/playlistItems?part=snippet&playlistId=${encodeURIComponent(playlistId)}&maxResults=50` +
      (pageToken ? `&pageToken=${pageToken}` : '');
    const data = await ytFetch(url);
    items = items.concat(data.items || []);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return items;
}

function renderPlaylists(playlists) {
  listEl.innerHTML = '';
  if (playlists.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'playlist-import-empty';
    empty.textContent = 'プレイリストが見つかりません';
    listEl.appendChild(empty);
    return;
  }
  playlists.forEach((playlist) => {
    const li = document.createElement('li');
    li.className = 'playlist-import-item';
    const count = playlist.contentDetails ? playlist.contentDetails.itemCount : null;
    li.textContent = playlist.snippet.title + (count != null ? `（${count}件）` : '');
    li.addEventListener('click', () => importPlaylist(playlist.id, playlist.snippet.title));
    listEl.appendChild(li);
  });
}

/** プレイリスト内動画のURLをクエリパラメータなしの形式で履歴に追加する。 */
async function importPlaylist(playlistId, playlistTitle) {
  listEl.innerHTML = '';
  setStatus(`${playlistTitle} を読み込み中...`);
  try {
    const items = await fetchAllPlaylistItems(playlistId);
    let history = loadHistory();
    let added = 0;
    items.forEach((item) => {
      const videoId = item.snippet && item.snippet.resourceId && item.snippet.resourceId.videoId;
      if (!videoId) return;
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const title = item.snippet.title;
      history = history.filter((h) => h.url !== url);
      history.unshift({ url, title, updatedAt: Date.now() });
      added++;
    });
    history = history.slice(0, MAX_HISTORY);
    saveHistory(history);
    setStatus(`${added}件インポートしました`);
    setTimeout(() => {
      closePanel();
      renderHistory();
    }, 800);
  } catch (e) {
    console.warn('[playlist-import] インポートに失敗しました', e);
    setStatus(`インポートに失敗しました: ${e.message}`);
  }
}

async function openImport() {
  if (!window.driveSync || !window.driveSync.isLoggedIn()) {
    alert('プレイリストをインポートするにはGoogleログインが必要です。');
    return;
  }
  if (window.settingsPanel) window.settingsPanel.close();
  listEl.innerHTML = '';
  openPanel();
  setStatus('プレイリストを取得中...');
  try {
    const playlists = await fetchAllPlaylists();
    setStatus('');
    renderPlaylists(playlists);
  } catch (e) {
    console.warn('[playlist-import] プレイリスト取得に失敗しました', e);
    setStatus(`プレイリストの取得に失敗しました: ${e.message}`);
  }
}

if (importButton) {
  importButton.addEventListener('click', (e) => {
    e.stopPropagation();
    openImport();
  });
}
if (closeButton) {
  closeButton.addEventListener('click', (e) => {
    e.stopPropagation();
    closePanel();
  });
}
if (backdrop) {
  backdrop.addEventListener('click', (e) => {
    e.stopPropagation();
    closePanel();
  });
}
