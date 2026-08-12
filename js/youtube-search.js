// 検索アイコンからYouTube Data APIで動画を検索し、選択した動画をそのまま再生する。
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

const searchButton = document.getElementById('searchButton');
const panel = document.getElementById('searchPanel');
const backdrop = document.getElementById('searchBackdrop');
const closeButton = document.getElementById('searchClose');
const searchInput = document.getElementById('searchInput');
const statusEl = document.getElementById('searchStatus');
const listEl = document.getElementById('searchResultList');
const urlInput = document.getElementById('youtubeUrl');

function setStatus(text) {
  if (statusEl) statusEl.textContent = text || '';
}

function openPanel() {
  if (panel) panel.classList.remove('hidden');
  listEl.innerHTML = '';
  setStatus('');
  if (searchInput) {
    searchInput.value = '';
    searchInput.focus();
  }
}

function closePanel() {
  if (panel) panel.classList.add('hidden');
}

function selectVideo(videoId) {
  urlInput.value = `https://www.youtube.com/watch?v=${videoId}`;
  closePanel();
  document.getElementById('playButton').click();
}

function renderResults(items) {
  listEl.innerHTML = '';
  if (items.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'search-result-empty';
    empty.textContent = '見つかりませんでした';
    listEl.appendChild(empty);
    return;
  }
  items.forEach((item) => {
    const videoId = item.id && item.id.videoId;
    if (!videoId) return;

    const li = document.createElement('li');
    li.className = 'search-result-item';

    const thumb = document.createElement('img');
    thumb.className = 'search-result-thumb';
    thumb.src = (item.snippet.thumbnails && item.snippet.thumbnails.default && item.snippet.thumbnails.default.url) || '';
    thumb.alt = '';

    const title = document.createElement('span');
    title.className = 'search-result-title';
    title.textContent = item.snippet.title;

    li.appendChild(thumb);
    li.appendChild(title);
    li.addEventListener('click', () => selectVideo(videoId));
    listEl.appendChild(li);
  });
}

async function runSearch(query) {
  const token = window.driveSync && window.driveSync.getAccessToken();
  if (!token) {
    setStatus('検索にはGoogleログインが必要です。');
    return;
  }
  setStatus('検索中...');
  listEl.innerHTML = '';
  try {
    const url = `${YOUTUBE_API_BASE}/search?part=snippet&type=video&maxResults=25&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error((body && body.error && body.error.message) || res.statusText);
    }
    const data = await res.json();
    setStatus('');
    renderResults(data.items || []);
  } catch (e) {
    console.warn('[youtube-search] 検索に失敗しました', e);
    setStatus(`検索に失敗しました: ${e.message}`);
  }
}

if (searchButton) {
  searchButton.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!window.driveSync || !window.driveSync.isLoggedIn()) {
      alert('YouTube検索にはGoogleログインが必要です。設定からログインしてください。');
      return;
    }
    openPanel();
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
if (searchInput) {
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const query = searchInput.value.trim();
      if (query) runSearch(query);
    }
  });
}
