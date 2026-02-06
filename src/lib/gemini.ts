import { GoogleGenerativeAI } from '@google/generative-ai'

// Gemini APIクライアントの初期化
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '')

/**
 * レシート画像をOCR解析して、日付・金額・科目を抽出
 */
export async function analyzeReceipt(imageBase64: string): Promise<{
  date: string
  amount: number
  description: string
  accountTitle?: string
}> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const prompt = `
以下のレシート画像を解析し、以下の情報をJSON形式で返してください：
- date: 日付（YYYY-MM-DD形式）
- amount: 金額（数値のみ）
- description: 商品名・摘要
- accountTitle: 勘定科目の候補（可能であれば）

JSON形式で返してください。
`

  try {
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageBase64,
          mimeType: 'image/jpeg',
        },
      },
    ])

    const response = await result.response
    const text = response.text()

    // JSONをパース
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        date: parsed.date || new Date().toISOString().split('T')[0],
        amount: parseFloat(parsed.amount) || 0,
        description: parsed.description || '',
        accountTitle: parsed.accountTitle,
      }
    }

    throw new Error('Failed to parse OCR result')
  } catch (error) {
    console.error('Gemini OCR Error:', error)
    throw error
  }
}

/**
 * 取引の異常検知（二重登録、高額支出、残高不整合）
 */
export async function detectAnomalies(transaction: {
  amount: number
  date: string
  description: string
  accountTitle: string
  existingTransactions?: Array<{
    amount: number
    date: string
    description: string
  }>
}): Promise<{
  isAlert: boolean
  reason?: string
}> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const prompt = `
以下の取引情報を分析し、異常がないかチェックしてください：

新規取引:
- 金額: ${transaction.amount}円
- 日付: ${transaction.date}
- 摘要: ${transaction.description}
- 科目: ${transaction.accountTitle}

既存取引:
${transaction.existingTransactions?.map(t => 
  `- ${t.date}: ${t.amount}円 (${t.description})`
).join('\n') || 'なし'}

以下の観点でチェックしてください：
1. 二重登録の可能性（同じ日付・金額・摘要の取引が既に存在するか）
2. 高額支出（5万円超の支出は警告）
3. その他の異常パターン

JSON形式で返してください：
{
  "isAlert": true/false,
  "reason": "アラート理由（該当する場合）"
}
`

  try {
    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        isAlert: parsed.isAlert || false,
        reason: parsed.reason,
      }
    }

    // フォールバック: シンプルなルールベース検知
    const isHighAmount = transaction.amount > 50000
    const isDuplicate = transaction.existingTransactions?.some(
      t => Math.abs(t.amount - transaction.amount) < 1 &&
           t.date === transaction.date &&
           t.description === transaction.description
    )

    return {
      isAlert: isHighAmount || !!isDuplicate,
      reason: isHighAmount ? '高額支出（5万円超）' : isDuplicate ? '二重登録の可能性' : undefined,
    }
  } catch (error) {
    console.error('Gemini Anomaly Detection Error:', error)
    // エラー時はルールベース検知にフォールバック
    const isHighAmount = transaction.amount > 50000
    return {
      isAlert: isHighAmount,
      reason: isHighAmount ? '高額支出（5万円超）' : undefined,
    }
  }
}
