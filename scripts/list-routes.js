#!/usr/bin/env node

/**
 * 開発サーバー起動時にアクセス可能なURL一覧を表示するスクリプト
 */

const fs = require('fs')
const path = require('path')

const appDir = path.join(__dirname, '../src/app')

// ルート一覧を収集
const routes = []

function scanDirectory(dir, basePath = '') {
  const items = fs.readdirSync(dir, { withFileTypes: true })

  for (const item of items) {
    const fullPath = path.join(dir, item.name)
    const routePath = basePath ? `${basePath}/${item.name}` : `/${item.name}`

    if (item.isDirectory()) {
      // Route Groups (括弧で囲まれたディレクトリ) は無視
      if (item.name.startsWith('(') && item.name.endsWith(')')) {
        scanDirectory(fullPath, basePath)
      } else {
        scanDirectory(fullPath, routePath)
      }
    } else if (item.name === 'page.tsx' || item.name === 'page.ts') {
      // page.tsx が見つかったらルートとして追加
      const route = basePath || '/'
      if (!routes.includes(route)) {
        routes.push(route)
      }
    }
  }
}

// スキャン実行
scanDirectory(appDir)

// ルートをソート
routes.sort()

// URL一覧を表示
console.log('\n========================================')
console.log('📋 アクセス可能なURL一覧')
console.log('========================================\n')

const routeMap = {
  '/': 'ホーム（ダッシュボードへリダイレクト）',
  '/dashboard': 'マイページ',
  '/accounting/register': '入出金登録',
  '/accounting/ledger': '集金・帳簿',
  '/collection': '集金管理',
  '/members': '部員管理',
  '/settings': '設定',
  '/settings/account-titles': '勘定科目マスター',
  '/settings/fiscal-years': '会計年度管理',
  '/guide': '操作ガイド',
  '/university/dashboard': '大学統合ダッシュボード',
  '/university/approvals': '承認待ち一覧',
}

routes.forEach((route) => {
  const description = routeMap[route] || '（説明なし）'
  console.log(`  ${route.padEnd(30)} → ${description}`)
})

console.log('\n========================================')
console.log('🌐 開発サーバーURL: http://localhost:3000')
console.log('========================================\n')
