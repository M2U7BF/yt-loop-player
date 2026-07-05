const input = document.getElementById("youtubeUrl");
const historyList = document.getElementById("historyList");
const historyPanel = document.getElementById("historyPanel");

let currentTab = "solo";

function isPlaylistItem(item) {
  return !!extractPlaylistId(item.url);
}

const STORAGE_KEY = "ytHistory";
const MAX_HISTORY = 60;

function loadHistory() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
}

function saveHistory(history) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  if (window.driveSync && window.driveSync.isLoggedIn()) {
    window.driveSync.push(history);
  }
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
      title = videoTitle ? `${videoTitle}` : "（タイトル取得失敗）";
    } else {
      title = `[list] (ID: ${playlistId.substring(0, 10)}...)`;
    }
  } else {
    // 単一動画の場合
    title = await fetchYoutubeTitle(url) || "（タイトル取得失敗）";
  }

  history.unshift({ url, title, updatedAt: Date.now() });
  history = history.slice(0, MAX_HISTORY);

  saveHistory(history);
}

function deleteHistoryItem(url) {
  const history = loadHistory().filter(item => item.url !== url);
  saveHistory(history);
}

function attachSwipeToDelete(li, content, item) {
  const SWIPE_THRESHOLD = 80;
  const MOVE_TOLERANCE = 6;
  let startX = 0;
  let startY = 0;
  let currentDx = 0;
  let dragging = false;
  let horizontal = false;
  let moved = false;

  const setX = (x) => {
    content.style.transform = `translateX(${x}px)`;
  };

  const begin = (x, y) => {
    startX = x;
    startY = y;
    currentDx = 0;
    dragging = true;
    horizontal = false;
    moved = false;
    content.style.transition = "none";
  };

  const update = (x, y) => {
    if (!dragging) return;
    const dx = x - startX;
    const dy = y - startY;
    if (!horizontal) {
      if (Math.abs(dx) < MOVE_TOLERANCE && Math.abs(dy) < MOVE_TOLERANCE) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        dragging = false;
        return;
      }
      horizontal = true;
    }
    moved = true;
    currentDx = Math.min(0, dx);
    setX(currentDx);
  };

  const finish = () => {
    if (!dragging) return;
    dragging = false;
    content.style.transition = "transform 0.2s ease";
    if (currentDx < -SWIPE_THRESHOLD) {
      setX(-li.offsetWidth);
      const height = li.offsetHeight;
      li.style.height = height + "px";
      requestAnimationFrame(() => {
        li.classList.add("removing");
        li.style.height = "0px";
      });
      const cleanup = () => {
        deleteHistoryItem(item.url);
        renderHistory();
      };
      li.addEventListener("transitionend", cleanup, { once: true });
    } else {
      setX(0);
    }
  };

  li.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    begin(t.clientX, t.clientY);
  }, { passive: true });
  li.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    update(t.clientX, t.clientY);
  }, { passive: true });
  li.addEventListener("touchend", finish);
  li.addEventListener("touchcancel", finish);

  li.addEventListener("mousedown", (e) => {
    begin(e.clientX, e.clientY);
    const onMove = (ev) => update(ev.clientX, ev.clientY);
    const onUp = () => {
      finish();
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });

  content.addEventListener("click", (e) => {
    if (moved) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    input.value = item.url;
    historyPanel.classList.add("hidden");
    document.getElementById('playButton').click();
  });
}

function renderHistory() {
  const history = loadHistory();
  if (history.length === 0) {
    historyPanel.classList.add("hidden");
    return;
  }

  const filtered = history.filter(item =>
    currentTab === "list" ? isPlaylistItem(item) : !isPlaylistItem(item)
  );

  historyList.innerHTML = "";

  if (filtered.length === 0) {
    const empty = document.createElement("li");
    empty.className = "history-empty";
    empty.textContent = "履歴がありません";
    historyList.appendChild(empty);
  }

  filtered.forEach(item => {
    const li = document.createElement("li");

    const bg = document.createElement("div");
    bg.className = "history-item-bg";
    bg.innerHTML = '<span class="material-symbols-outlined">delete</span>';

    const content = document.createElement("div");
    content.className = "history-item-content";
    content.textContent = item.title;

    li.appendChild(bg);
    li.appendChild(content);
    attachSwipeToDelete(li, content, item);

    historyList.appendChild(li);
  });

  historyPanel.classList.remove("hidden");
}

document.querySelectorAll(".history-tab").forEach(tab => {
  tab.addEventListener("click", (e) => {
    e.stopPropagation();
    currentTab = tab.dataset.tab;
    document.querySelectorAll(".history-tab").forEach(t =>
      t.classList.toggle("active", t === tab)
    );
    renderHistory();
  });
});

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
  historyPanel.classList.add("hidden");
}

document.addEventListener("click", (e) => {
  if (!input.contains(e.target) && !historyPanel.contains(e.target)) {
    historyPanel.classList.add("hidden");
  }
});