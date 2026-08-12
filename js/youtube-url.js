// YouTubeのURLから動画ID・プレイリストIDを抽出する純粋関数群。

/**
 * 動画URLから11文字の動画IDを抽出する。
 * @param {string} url
 * @returns {string|null}
 */
export function extractVideoId(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

/**
 * プレイリストURLから list= パラメータの値を抽出する。
 * @param {string} url
 * @returns {string|null}
 */
export function extractPlaylistId(url) {
  const regExp = /[?&]list=([^#\&\?]+)/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}
