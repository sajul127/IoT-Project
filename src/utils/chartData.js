export function makeBars(count, min, max) {
  return Array.from({ length: count }, (_, index) => {
    const value = Math.sin(index * 1.8) * 22 + Math.cos(index * 0.65) * 15 + 54
    return Math.max(min, Math.min(max, Math.round(value)))
  })
}

export function makeSpectrum() {
  return Array.from({ length: 58 }, (_, index) => {
    const center = Math.max(0, 78 - Math.abs(index - 18) * 3.1)
    const noise = Math.sin(index * 2.4) * 14 + Math.cos(index * 0.8) * 9
    return Math.max(8, Math.min(90, Math.round(center + noise)))
  })
}
