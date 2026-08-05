### 【クラブポータル】決算提出・部内承認・監査フロー

#### 0. 運用スキーム
- **日々の入出金**: 個別承認なし。即時反映。
- **決算**: 作業者提出 → **クラブ責任者の部内承認** → 監査人の承認／差戻し。

#### 1. ステータス（`club_auditor_audit_status_{clubId}`）
1. `not_started` — 作成中・ロックなし
2. `awaiting_manager_approval` — 部内承認待ち・**全域ロック ON**
3. `in_review` — 監査中・ロック継続（監査人の承認・差戻活性）
4. `approved` — 承認済・ロック継続
5. `rejected` — 差戻・**ロック解除**

#### 2. 双六 UI（`club_settlement_history_flow_{clubId}`）
`作成中 → 部内承認待ち → 監査中 → 承認済`（差戻し発生時は「差戻し」を挿入）

#### 3. ログイン権限
- 作業者PW → `role: "worker"`（提出・修正）
- 責任者PW → `role: "manager"`（閲覧・「決算を承認する」）
- 学校／監査人なりすましでも部内承認操作可（`canActAsClubManager`）

#### 4. ロック UI
- `SettlementLockAlert`（`bg-red-50 text-red-600 border-red-200`）
- 入出金・帳簿・集金・予実・設定の書き込みを `disabled`（決算ロック中、および責任者ログイン時）
