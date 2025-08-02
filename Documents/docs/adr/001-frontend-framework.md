# ADR-001: フロントエンドフレームワークの選定

## ステータス
採用

## 決定日
2025年1月15日

## 決定者
根岸祐樹

## 背景・コンテキスト

東京都公式アプリのAI音声対話機能をMVPとして開発するにあたり、フロントエンドフレームワークの選定が必要。

### 要求事項
- サーバーサイドレンダリング（SEO対応）
- 音声処理機能の実装容易性
- TypeScript対応
- 開発・保守性の高さ
- 公的機関のシステムとしての安定性
- レスポンシブ対応

### 検討候補
1. **Next.js 14 (App Router)**
2. **Nuxt.js 3**
3. **SvelteKit**
4. **Remix**

## 決定内容

**Next.js 14 (App Router)** を採用する。

## 理由・根拠

### Next.js 14を選択した理由

#### 1. 技術的優位性
- **フルスタック対応**: APIルートでバックエンドも統合開発可能
- **App Router**: 最新のReact 18機能（Server Components、Streaming）活用
- **TypeScript統合**: ゼロコンフィグでTypeScript対応
- **音声API統合**: Web Audio API、MediaRecorderとの親和性が高い

#### 2. パフォーマンス
- **自動最適化**: 画像最適化、コード分割が自動
- **サーバーサイドレンダリング**: 初期表示速度の向上
- **エッジランタイム**: Vercel Edge Functionsで低レイテンシ実現

#### 3. 開発・運用面
- **豊富なエコシステム**: React生態系の活用
- **デプロイ容易性**: Vercel、Cloud Run等への簡単デプロイ
- **ドキュメント充実**: 公式ドキュメントが豊富
- **コミュニティ**: 大規模なコミュニティサポート

#### 4. MVP要件適合性
- **高速開発**: 豊富なコンポーネントライブラリ
- **段階的拡張**: 将来機能の追加が容易
- **PWA対応**: next-pwaによるオフライン対応

### 他候補との比較

| 項目 | Next.js 14 | Nuxt.js 3 | SvelteKit | Remix |
|------|------------|-----------|-----------|-------|
| TypeScript | ◎ | ◎ | ◎ | ◎ |
| SSR/SSG | ◎ | ◎ | ◎ | ◎ |
| API統合 | ◎ | ○ | ○ | ◎ |
| 音声処理 | ◎ | ○ | ○ | ○ |
| エコシステム | ◎ | ○ | △ | ○ |
| 学習コスト | ○ | ○ | ◎ | ○ |
| 企業採用実績 | ◎ | ○ | △ | △ |

## 技術仕様

### 採用バージョン
- **Next.js**: 14.x (App Router)
- **React**: 18.x
- **TypeScript**: 5.x

### 主要依存関係
```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "typescript": "^5.0.0"
  }
}
```

### アーキテクチャパターン
- **App Router**: /app ディレクトリ構造
- **Server Components**: サーバーサイド処理最適化
- **Client Components**: 音声処理等のブラウザ機能

### ディレクトリ構造
```
src/
├── app/                 # App Router
│   ├── api/            # API Routes
│   ├── chat/           # チャット機能
│   ├── voice/          # 音声機能
│   └── globals.css     # グローバルスタイル
├── components/         # 再利用可能コンポーネント
├── hooks/              # カスタムフック
├── lib/                # ユーティリティ
├── services/           # ビジネスロジック
└── types/              # TypeScript型定義
```

## 結果・影響

### 期待される効果
1. **開発速度向上**: フルスタック統合による効率化
2. **パフォーマンス最適化**: 自動最適化機能活用
3. **メンテナンス性**: TypeScript + Reactエコシステム
4. **拡張性**: 将来機能の段階的追加

### 制約・リスク
1. **Reactエコシステム依存**: React以外の技術選択肢制限
2. **バンドルサイズ**: React依存によるサイズ増加
3. **学習コスト**: App Routerの新しいパラダイム

### 対応策
- **バンドルサイズ**: Tree shaking、動的インポート活用
- **学習コスト**: 段階的移行、チーム内知識共有

## 関連決定
- [ADR-002: スタイリング手法の選定](./002-styling-approach.md)
- [ADR-003: 状態管理ライブラリの選定](./003-state-management.md)
- [ADR-004: UIコンポーネントライブラリの選定](./004-ui-library.md)

## 参考資料
- [Next.js 14 公式ドキュメント](https://nextjs.org/docs)
- [React 18 公式ドキュメント](https://react.dev)
- [Next.js App Router migration guide](https://nextjs.org/docs/app/building-your-application/upgrading/app-router-migration)