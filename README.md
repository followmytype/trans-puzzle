# 轉珠遊戲（Web / Mobile）

一個可以在手機上透過瀏覽器遊玩的轉珠（6x5）消除遊戲，支援拖曳路徑推珠、連鎖消除、重力與補珠。

## 開發與執行

### 安裝依賴

```bash
npm install
```

### 開發模式（自動重新載入）

```bash
npm run dev
```

### 建置生產版（驗證編譯）

```bash
npm run build
```

### 預覽生產版

```bash
npm run preview
```

## 遊戲說明

- 棋盤為 6 欄 x 5 列。
- 按住任一珠子並拖曳到相鄰格子時，會攜帶該珠子沿路推動其它珠子（類似轉珠機制）。
- 放開後自動判定橫向或縱向相同顏色 3 連以上的消除，計算連擊數並加分。
- 消除後珠子會下落並自動補齊，可能連鎖直到無法再消除。

## 檔案結構

- [index.html](index.html)：入口頁面與 viewport 設定
- [src/styles.css](src/styles.css)：行動端友善樣式
- [src/main.ts](src/main.ts)：初始化程式進入點
- [src/game.ts](src/game.ts)：棋盤渲染、拖曳邏輯、消除判定與重力補珠
- [vite.config.ts](vite.config.ts)：Vite 設定
- [tsconfig.json](tsconfig.json)：TypeScript 設定

## 後續擴充建議

- 加入技能、屬性相剋、回合與敵人 AI。
- 動畫優化（移動、消除、下落）。
- 音效與特效。
- 適配多語系與儲存分數榜。
