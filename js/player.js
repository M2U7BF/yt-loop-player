// YouTube IFrame Playerの生成・再生制御（単一動画は無限ループ、プレイリストは末尾から先頭へ循環）。
import { extractPlaylistId, extractVideoId } from './youtube-url.js';
import { addHistory } from './history-store.js';
import { hideHistoryPanel } from './history-ui.js';

const urlInput = document.getElementById('youtubeUrl');
const playButton = document.getElementById('playButton');
const pauseButton = document.getElementById('pauseButton');
const stopButton = document.getElementById('stopButton');

/** @type {YT.Player|null} */
let player = null;
let enablePause = false;
let isPlaylist = false;
let currentVideoId = null;
let currentPlaylistId = null;

/** 現在生成済みのプレイヤーインスタンスを返す（stall-recoveryから参照）。 */
export function getPlayer() {
  return player;
}

/** 現在プレイリスト再生中かどうかを返す（stall-recoveryから参照）。 */
export function isPlaylistActive() {
  return isPlaylist;
}

function loadYouTubeIframeApi() {
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  const firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

/** クエリパラメータ ?url= を入力欄へ反映する。反映した場合のみtrueを返す。 */
function applyUrlFromQuery() {
  const urlFromParam = new URLSearchParams(window.location.search).get('url');
  if (urlInput.value || !urlFromParam) return false;
  urlInput.value = decodeURIComponent(urlFromParam);
  return true;
}

/** クエリパラメータ ?pause=true で一時停止ボタンの表示を有効化する。 */
function applyEnablePauseFromQuery() {
  enablePause = new URLSearchParams(window.location.search).get('pause') === 'true';
}

function updateButtonDisplay(isPlaying) {
  if (isPlaying) {
    playButton.classList.add('hidden');
    stopButton.classList.remove('hidden');
    if (enablePause) pauseButton.classList.remove('hidden');
  } else {
    playButton.classList.remove('hidden');
    stopButton.classList.add('hidden');
    if (enablePause) pauseButton.classList.add('hidden');
  }
}

function handlePlayerReady() {
  if (applyUrlFromQuery()) {
    playButton.click();
  }
  applyEnablePauseFromQuery();
}

function handlePlayerStateChange(event) {
  if (event.data === -1) {
    addHistory(urlInput.value);
  } else if (event.data === YT.PlayerState.PLAYING) {
    updateButtonDisplay(true);
  } else if (event.data === YT.PlayerState.ENDED) {
    if (isPlaylist) {
      const currentIndex = player.getPlaylistIndex();
      const playlist = player.getPlaylist();
      if (playlist && currentIndex >= playlist.length - 1) {
        player.playVideoAt(0); // 最後の動画に到達 → 最初から再生
      } else {
        player.nextVideo();
      }
    } else {
      player.playVideo(); // 単一動画は同じ動画をループ
    }
  } else if (!enablePause && event.data === YT.PlayerState.PAUSED) {
    player.playVideo();
  }
  hideHistoryPanel();
}

window.onYouTubeIframeAPIReady = function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', {
    height: '100%',
    width: '100%',
    playerVars: {
      controls: 1,
      rel: 0,
      showinfo: 0,
      iv_load_policy: 3,
      playsinline: 1,
    },
    events: {
      onReady: handlePlayerReady,
      onStateChange: handlePlayerStateChange,
    },
  });
};

playButton.addEventListener('click', () => {
  const url = urlInput.value;

  if (player && player.getPlayerState() === YT.PlayerState.PAUSED) {
    player.playVideo();
    return;
  }

  const playlistId = extractPlaylistId(url);
  const videoId = extractVideoId(url);

  if (playlistId) {
    isPlaylist = true;
    if (playlistId === currentPlaylistId) {
      player.playVideoAt(0);
    } else {
      player.loadPlaylist({ list: playlistId, listType: 'playlist' });
      currentPlaylistId = playlistId;
      currentVideoId = null;
    }
    player.unMute();
  } else if (videoId) {
    isPlaylist = false;
    if (videoId === currentVideoId) {
      player.seekTo(0);
      player.playVideo();
    } else {
      player.loadVideoById(videoId);
      currentVideoId = videoId;
      currentPlaylistId = null;
    }
    player.unMute();
  } else {
    alert('有効なYouTubeのURLを入力してください。');
  }
});

stopButton.addEventListener('click', () => {
  if (player) {
    player.pauseVideo();
    player.seekTo(0);
  }
  updateButtonDisplay(false);
});

pauseButton.addEventListener('click', () => {
  if (player) {
    player.pauseVideo();
  }
  updateButtonDisplay(false);
});

urlInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    playButton.click();
  }
});

loadYouTubeIframeApi();
