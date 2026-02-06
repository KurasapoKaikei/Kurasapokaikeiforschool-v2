import { NextRequest, NextResponse } from "next/server"
import { analyzeReceipt } from "@/lib/gemini"

export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const imageBase64 = body?.image as string | undefined
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json(
        { error: "image (base64) is required" },
        { status: 400 }
      )
    }
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "")
    const result = await analyzeReceipt(base64Data)
    return NextResponse.json(result)
  } catch (error) {
    console.error("OCR API Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "OCR failed" },
      { status: 500 }
    )
  }
}
