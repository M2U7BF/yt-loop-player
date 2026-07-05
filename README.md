# YouTube動画を自動リピートするツール

## 今すぐ使う
下記URLをクリック。<br>
https://m2u7bf.github.io/yt-loop-player/index.html

## 用途
* YouTube動画の無限リピート再生
* 作業用BGMのプレイヤーとして使えます。

## 使い方
１） ページの表示<br>
<img src="https://github.com/M2U7BF/yt-loop-player/blob/main/readme/Screenshot%20from%202025-11-11%2014-45-51.png" width="500px">

２）URLの入力<br>
<img src="https://github.com/M2U7BF/yt-loop-player/blob/main/readme/Screenshot%20from%202025-11-11%2014-50-02.png" width="500px">

３）再生ボタンを押す<br>
<img src="https://github.com/M2U7BF/yt-loop-player/blob/main/readme/Screenshot%20from%202025-11-11%2014-50-39.png" width="500px">

## 注意点
* 動画の停止は停止ボタンから行ってください。簡易的にバックグラウンド再生に対応した関係でiframeのクリックでは停止できません。

## 機能
* YouTube動画の無限再生
* URLクエリパラメータを使用可能
  * `url`というパラメータに任意のYouTube URLを入れてアクセスすると、jsでそれを読み込み、URL入力欄に自動入力します。
* PC、モバイルの双方で利用可能
* バックグラウンド再生
* 入力履歴の保持（最大20件）
  * 新しい履歴ほど上に表示されます。
* Googleアカウントでの入力履歴のクラウド同期（要管理者設定。詳細は下記参照）

## クラウド同期のセットアップ（リポジトリ管理者向け）
入力履歴はGoogleアカウントでログインすることで、Google Driveのアプリ専用領域（`appDataFolder`。ユーザーからは見えない領域で、このアプリ以外はアクセスできません）に同期できます。動作させるには、事前に以下の設定が必要です。

1. [Google Cloud Console](https://console.cloud.google.com/)でプロジェクトを作成（または既存のものを使用）。
2. 「APIとサービス」→「有効なAPIとサービス」から **Google Drive API** を有効化。
3. 「APIとサービス」→「OAuth同意画面」を設定（外部/テスト用途で可。テストユーザーとして自分のGoogleアカウントを追加すればGoogleの審査なしで利用できます）。
4. 「APIとサービス」→「認証情報」から **OAuthクライアントID**（アプリケーションの種類: ウェブアプリケーション）を作成。
   * 承認済みのJavaScript生成元に `https://m2u7bf.github.io` （ローカル確認用に `http://localhost:任意のポート` も）を追加。
5. 発行されたクライアントIDを `js/drive-sync.js` 内の `GOOGLE_CLIENT_ID` 定数に設定。

未設定のままでも他の機能には影響しません（ログインボタンを押すと設定を促すメッセージが表示されるだけです）。

## 開発経緯
* 作業BGM用にYouTubeの動画を無限再生するツールがほしかった。
* 無料で実現したかった。
  * 便利ツールサイトで同様のサイトがあったが、無限自動再生が有料だった。
  * Youtube, Youtube musicで自動再生を無限にやろうとする場合、有料プランへの参加が必要だった。
* YouTubeの無料プランだと、定期的に「視聴してますか？」と問うようなポップアップが表示され、再生停止されてしまい無限再生ができなかった。

## 振り返り
* モバイルでのシームレスなバックグラウンド再生は非常に難しい。
