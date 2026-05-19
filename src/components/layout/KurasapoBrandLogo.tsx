import Image from "next/image"
import { cn } from "@/lib/utils"

export const KURASAPO_LOGO_PATH = "/kurasapo_logo_fix_RGB.png"

type KurasapoBrandLogoProps = {
  className?: string
}

/** サイドバー上部のクラサポ会計ロゴ（サイドバー幅いっぱい・アスペクト比維持） */
export function KurasapoBrandLogo({ className }: KurasapoBrandLogoProps) {
  return (
    <div className={cn("flex w-full justify-center", className)}>
      <Image
        src={KURASAPO_LOGO_PATH}
        alt="クラサポ会計"
        width={224}
        height={80}
        sizes="224px"
        className="h-auto w-full max-w-[224px] object-contain"
        priority
      />
    </div>
  )
}
