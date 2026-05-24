const input = document.getElementById("youtubeUrl");
const historyList = document.getElementById("historyList");

const STORAGE_KEY = "ytHistory";
const MAX_HISTORY = 60;

function loadHistory() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
}

function saveHistory(history) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

async function fetchYoutubeTitle(url) {
  try {
    const api = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(api);
    if (!res.ok) return null;
    const data = await res.json();
    return data.title;
  } catch {
    return null;
  }
}

// プレイリストの最初の動画URLを取得
function getFirstVideoUrlFromPlaylist(url) {
  const playlistId = extractPlaylistId(url);
  if (!playlistId) return null;
  
  // プレイリストURLに含まれる動画ID（v=パラメータ）を取得
  const videoId = extractVideoId(url);
  if (videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }
  
  return null;
}

async function addHistory(url) {
  if (!url) return;
  
  const playlistId = extractPlaylistId(url);
  const videoId = extractVideoId(url);
  
  if (!playlistId && !videoId) return;

  let history = loadHistory();
  history = history.filter(item => item.url !== url);

  let title;
  
  if (playlistId) {
    // プレイリストの場合
    const firstVideoUrl = getFirstVideoUrlFromPlaylist(url);
    if (firstVideoUrl) {
      const videoTitle = await fetchYoutubeTitle(firstVideoUrl);
      title = videoTitle ? `[プレイリスト] ${videoTitle}` : "[プレイリスト] （タイトル取得失敗）";
    } else {
      title = `[プレイリスト] (ID: ${playlistId.substring(0, 10)}...)`;
    }
  } else {
    // 単一動画の場合
    title = await fetchYoutubeTitle(url) || "（タイトル取得失敗）";
  }

  history.unshift({ url, title });
  history = history.slice(0, MAX_HISTORY);

  saveHistory(history);
}

function renderHistory() {
  const history = loadHistory();
  if (history.length === 0) {
    historyList.classList.add("hidden");
    return;
  }

  historyList.innerHTML = "";
  history.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item.title;

    li.addEventListener("click", () => {
      input.value = item.url;
      historyList.classList.add("hidden");
      document.getElementById('playButton').click();
    });

    historyList.appendChild(li);
  });

  historyList.classList.remove("hidden");
}

input.addEventListener("change", () => {
  const urlText = input.value.trim();
  if (urlText) {
    addHistory(urlText);
  }
});

input.addEventListener("focus", () => {
  renderHistory();
});

function hiddenHistory() {
  historyList.classList.add("hidden");
}

document.addEventListener("click", (e) => {
  if (!input.contains(e.target) && !historyList.contains(e.target)) {
    historyList.classList.add("hidden");
  }
});