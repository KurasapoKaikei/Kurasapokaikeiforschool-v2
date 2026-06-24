/** クラブ設定：団体情報（代表者欄・クラブ単位で localStorage 保存） */

export const CLUB_ORGANIZATION_PROFILES_KEY =
  "kurasaokaikei-club-organization-profiles"

export const CLUB_ORGANIZATION_PROFILE_CHANGED_EVENT =
  "kurasaokaikei-club-organization-profile-changed"

export type ClubOrganizationProfile = {
  representativeTitle: string
  representativeLastName: string
  representativeFirstName: string
  representativePhone: string
}

export const emptyClubOrganizationProfile = (): ClubOrganizationProfile => ({
  representativeTitle: "",
  representativeLastName: "",
  representativeFirstName: "",
  representativePhone: "",
})

function dispatchChanged(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(CLUB_ORGANIZATION_PROFILE_CHANGED_EVENT))
}

function loadAllProfiles(): Record<string, ClubOrganizationProfile> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(CLUB_ORGANIZATION_PROFILES_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, Partial<ClubOrganizationProfile>>
    if (!parsed || typeof parsed !== "object") return {}
    const result: Record<string, ClubOrganizationProfile> = {}
    for (const [clubId, item] of Object.entries(parsed)) {
      if (!clubId) continue
      result[clubId] = {
        representativeTitle:
          typeof item.representativeTitle === "string"
            ? item.representativeTitle
            : "",
        representativeLastName:
          typeof item.representativeLastName === "string"
            ? item.representativeLastName
            : "",
        representativeFirstName:
          typeof item.representativeFirstName === "string"
            ? item.representativeFirstName
            : "",
        representativePhone:
          typeof item.representativePhone === "string"
            ? item.representativePhone
            : "",
      }
    }
    return result
  } catch {
    return {}
  }
}

export function loadClubOrganizationProfile(
  clubId: string
): ClubOrganizationProfile {
  const id = clubId.trim()
  if (!id) return emptyClubOrganizationProfile()
  return loadAllProfiles()[id] ?? emptyClubOrganizationProfile()
}

export function saveClubOrganizationProfile(
  clubId: string,
  profile: ClubOrganizationProfile
): void {
  const id = clubId.trim()
  if (!id || typeof window === "undefined") return
  const all = loadAllProfiles()
  all[id] = {
    representativeTitle: profile.representativeTitle.trim(),
    representativeLastName: profile.representativeLastName.trim(),
    representativeFirstName: profile.representativeFirstName.trim(),
    representativePhone: profile.representativePhone.trim(),
  }
  localStorage.setItem(CLUB_ORGANIZATION_PROFILES_KEY, JSON.stringify(all))
  dispatchChanged()
}
