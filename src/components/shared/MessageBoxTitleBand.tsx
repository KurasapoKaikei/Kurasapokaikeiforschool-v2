"use client"

/**
 * メッセージBOX画面トップのページタイトル
 * （集金管理＞集金実績と同じ：白背景・左5pxアクセント・テーマ色見出し）
 */
export function MessageBoxTitleBand({
  title = "メッセージBOX",
  accentColor,
  description,
  className = "",
}: {
  title?: string
  accentColor: string
  description?: string
  className?: string
}) {
  return (
    <div className={`shrink-0 px-6 pt-4 ${className}`.trim()}>
      <div
        className="rounded-t-lg border border-b-0 border-gray-200 px-6 py-4"
        style={{
          borderLeftWidth: 5,
          borderLeftColor: accentColor,
          backgroundColor: "white",
        }}
      >
        <h2 className="text-xl font-semibold" style={{ color: accentColor }}>
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-sm text-[#6B7280]">{description}</p>
        ) : null}
      </div>
    </div>
  )
}

/** 管理者ポータル・メッセージBOX（集金実績ページと同形式のタイトル色） */
export const SCHOOL_MESSAGE_BOX_BAND_COLOR = "#4A90E2"

/** クラブポータル・メッセージBOX */
export const CLUB_MESSAGE_BOX_BAND_COLOR = "#4A90E2"
