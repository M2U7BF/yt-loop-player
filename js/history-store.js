// 再生履歴の永続化とデータ取得を担うストア層（DOM操作は行わない）。
import { extractPlaylistId, extractVideoId } from './youtube-url.js';

export const STORAGE_KEY = 'ytHistory';
export const MAX_HISTORY = 60;

/**
 * @typedef {{ url: string, title: string, updatedAt: number }} HistoryItem
 */

/** @returns {HistoryItem[]} */
export function loadHistory() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
}

/**
 * 履歴を保存し、ログイン中であればGoogle Driveへの同期も要求する。
 * @param {HistoryItem[]} history
 */
export function saveHistory(history) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  if (window.driveSync && window.driveSync.isLoggedIn()) {
    window.driveSync.push(history);
  }
}

/**
 * oEmbed経由で動画タイトルを取得する。失敗時はnull。
 * @param {string} url
 * @returns {Promise<string|null>}
 */
export async function fetchYoutubeTitle(url) {
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

/**
 * プレイリストURLに含まれる動画ID（v=パラメータ）から先頭動画のURLを組み立てる。
 * @param {string} url
 * @returns {string|null}
 */
export function getFirstVideoUrlFromPlaylist(url) {
  if (!extractPlaylistId(url)) return null;
  const videoId = extractVideoId(url);
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
}

/**
 * URLを履歴の先頭に追加する（同一URLは差し替え、タイトルは非同期取得）。
 * @param {string} url
 */
export async function addHistory(url) {
  if (!url) return;

  const playlistId = extractPlaylistId(url);
  const videoId = extractVideoId(url);
  if (!playlistId && !videoId) return;

  let title;
  if (playlistId) {
    const firstVideoUrl = getFirstVideoUrlFromPlaylist(url);
    if (firstVideoUrl) {
      const videoTitle = await fetchYoutubeTitle(firstVideoUrl);
      title = videoTitle || '（タイトル取得失敗）';
    } else {
      title = `[list] (ID: ${playlistId.substring(0, 10)}...)`;
    }
  } else {
    title = (await fetchYoutubeTitle(url)) || '（タイトル取得失敗）';
  }

  let history = loadHistory().filter((item) => item.url !== url);
  history.unshift({ url, title, updatedAt: Date.now() });
  history = history.slice(0, MAX_HISTORY);

  saveHistory(history);
}

/**
 * @param {string} url
 */
export function deleteHistoryItem(url) {
  saveHistory(loadHistory().filter((item) => item.url !== url));
}
