// YouTube APIスクリプトの読み込み
var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

var player;
var enablePause = false;
var isPlaylist = false; // プレイリストかどうかのフラグ
var currentVideoId = null;
var currentPlaylistId = null;

var SHUFFLE_STORAGE_KEY = 'ytShuffleEnabled';
var shuffleEnabled = localStorage.getItem(SHUFFLE_STORAGE_KEY) === 'true';

function inputUrlFromQuery() {
  var urlParams = new URLSearchParams(window.location.search);
  var urlFromParam = urlParams.get('url');
  var urlInput = document.getElementById('youtubeUrl');
  if (urlInput.value) {
    return false;
  }
  if (urlFromParam) {
    urlInput.value = decodeURIComponent(urlFromParam);
    return true;
  }
  return false;
}

function manageEnablePauseFromQuery() {
  var urlParams = new URLSearchParams(window.location.search);
  var urlFromParam = urlParams.get('pause');
  enablePause = urlFromParam === 'true' ? true : false;
}

function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', {
    height: '100%',
    width: '100%',
    playerVars: {
      'controls': 1,
      'rel': 0,
      'showinfo': 0,
      'iv_load_policy': 3,
      'playsinline': 1
    },
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange
    }
  });
}

function onPlayerReady(event) {
  if (inputUrlFromQuery()) {
    document.getElementById('playButton').click();
  }
  manageEnablePauseFromQuery();
}

function onPlayerStateChange(event) {
  if (event.data == -1) {
    var url = document.getElementById('youtubeUrl').value;
    addHistory(url);
  }
  else if (event.data == YT.PlayerState.PLAYING) {
    updateButtonDisplay(true);
  }
  else if (event.data == YT.PlayerState.ENDED) {
    if (isPlaylist) {
      // プレイリストの場合
      var currentIndex = player.getPlaylistIndex();
      var playlist = player.getPlaylist();
      
      if (playlist && currentIndex >= playlist.length - 1) {
        // 最後の動画に到達 → 最初から再生
        player.playVideoAt(0);
      } else {
        // 次の動画へ
        player.nextVideo();
      }
    } else {
      // 単一動画の場合は従来通りループ
      player.playVideo();
    }
  }
  else if (!enablePause && event.data == YT.PlayerState.PAUSED) {
    player.playVideo();
  }
  hiddenHistory();
}

function updateButtonDisplay(isPlaying) {
  var playButton = document.getElementById('playButton');
  var stopButton = document.getElementById('stopButton');
  var pauseButton = document.getElementById('pauseButton');
  if (isPlaying) {
    playButton.classList.add("hidden");
    stopButton.classList.remove("hidden");
    if (enablePause) pauseButton.classList.remove("hidden");
  } else {
    playButton.classList.remove("hidden");
    stopButton.classList.add("hidden");
    if (enablePause) pauseButton.classList.add("hidden");
  }
}

function updateShuffleButtonDisplay() {
  var shuffleButton = document.getElementById('shuffleButton');
  shuffleButton.classList.toggle('active', shuffleEnabled);
}

document.getElementById('shuffleButton').addEventListener('click', function () {
  shuffleEnabled = !shuffleEnabled;
  localStorage.setItem(SHUFFLE_STORAGE_KEY, shuffleEnabled);
  updateShuffleButtonDisplay();

  if (isPlaylist && currentPlaylistId) {
    // 再生中のプレイリストに即座に反映するため先頭から読み込み直す
    player.loadPlaylist({
      list: currentPlaylistId,
      listType: 'playlist'
    });
    player.setShuffle(shuffleEnabled);
  }
});

updateShuffleButtonDisplay();

document.getElementById('playButton').addEventListener('click', function () {
  var url = document.getElementById('youtubeUrl').value;

  if (player && player.getPlayerState() == YT.PlayerState.PAUSED) {
    player.playVideo();
    return;
  }

  var playlistId = extractPlaylistId(url);
  var videoId = extractVideoId(url);

  if (playlistId) {
    // プレイリストURLの場合
    isPlaylist = true;
    if (playlistId === currentPlaylistId) {
      player.playVideoAt(0);
    } else {
      player.loadPlaylist({
        list: playlistId,
        listType: 'playlist'
      });
      player.setShuffle(shuffleEnabled);
      currentPlaylistId = playlistId;
      currentVideoId = null;
    }
    player.unMute();
  } else if (videoId) {
    // 単一動画の場合
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
    alert("有効なYouTubeのURLを入力してください。");
  }
});

document.getElementById('stopButton').addEventListener('click', function () {
  if (player) {
    player.pauseVideo();
    player.seekTo(0);
  }
  updateButtonDisplay(false);
});

document.getElementById('pauseButton').addEventListener('click', function () {
  if (player) {
    player.pauseVideo();
  }
  updateButtonDisplay(false);
});

document.getElementById('youtubeUrl').addEventListener('keydown', function (event) {
  if (event.key === 'Enter') {
    document.getElementById('playButton').click();
  }
});

function extractVideoId(url) {
  var regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  var match = url.match(regExp);
  if (match && match[2].length == 11) {
    return match[2];
  } else {
    return null;
  }
}

// プレイリストIDを抽出する関数
function extractPlaylistId(url) {
  var regExp = /[?&]list=([^#\&\?]+)/;
  var match = url.match(regExp);
  return match ? match[1] : null;
}