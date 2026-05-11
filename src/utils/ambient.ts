export const AMBIENT_DAY_ID = 'b7dAF4WYSyA'
export const AMBIENT_NIGHT_ID = 'kmythL1LppA'

export function getAmbientVideoId(now: Date = new Date()): string {
  const hour = now.getHours()
  return hour >= 6 && hour < 18 ? AMBIENT_DAY_ID : AMBIENT_NIGHT_ID
}
