# youtube動画を自動リピートするツール

## 今すぐ使う
下記URLをクリック。<br>
https://m2u7bf.github.io/yt_auto_web/index.html

## 使い方
１）webページのホスティング
```
// 以下のように任意のサーバーでindex.htmlをホスティングする。
https://m2u7bf.github.io/yt_auto_web/index.html?url={動画URL}
```


２） ページの表示
![](https://github.com/M2U7BF/yt_auto_web/blob/main/readme/Screenshot%20from%202025-11-11%2014-45-51.png)

３）URLの入力
![](https://github.com/M2U7BF/yt_auto_web/blob/main/readme/Screenshot%20from%202025-11-11%2014-50-02.png)

４）再生開始
![](https://github.com/M2U7BF/yt_auto_web/blob/main/readme/Screenshot%20from%202025-11-11%2014-50-39.png)

### 機能
- `url`クエリに指定のURLを入れてページを表示すると、jsでそれを読み込み、URL入力欄に自動入力する。
- ブラウザを開くだけなので、pc,モバイルの双方に対応。
- モバイルの対応ブラウザ（Brave等）でのバックグラウンド再生

## 課題
- 

## 開発経緯
- 作業BGMで無限再生するツールがほしかった。
- 便利ツールサイトで同様のサイトがあったが、無限自動再生が有料だった。
- Youtube, Youtube musicで自動再生を無限にやろうとする場合、有料プランへの参加が必要。
  - 無料プランだと定期的に「視聴してますか？」と問うようなポップアップが表示され、再生停止される
- 