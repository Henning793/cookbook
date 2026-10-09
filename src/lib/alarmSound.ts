// Alarmlyd for klokkene i kokemodus, laget med Web Audio så det ikke trengs
// noen lydfil. Nettleseren lar bare lyd starte etter et trykk, så
// unlockAlarmSound() kalles når en klokke startes.

let context: AudioContext | null = null
let loop: number | null = null

export function unlockAlarmSound() {
  try {
    context ??= new AudioContext()
    if (context.state === 'suspended') void context.resume()
  } catch {
    context = null
  }
}

function beep(at: number, frequency: number) {
  if (!context) return
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(0.5, at + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.25)
  oscillator.connect(gain).connect(context.destination)
  oscillator.start(at)
  oscillator.stop(at + 0.3)
}

function ringOnce() {
  if (context) {
    if (context.state === 'suspended') void context.resume()
    const now = context.currentTime
    beep(now, 880)
    beep(now + 0.3, 880)
    beep(now + 0.6, 1175)
  }
  if ('vibrate' in navigator) navigator.vibrate([300, 150, 300, 150, 600])
}

// Ringer hvert annet sekund til stopAlarm() kalles, men gir seg etter to minutter.
export function startAlarm() {
  if (loop !== null) return
  ringOnce()
  const startedAt = Date.now()
  loop = window.setInterval(() => {
    if (Date.now() - startedAt > 120_000) {
      stopAlarm()
      return
    }
    ringOnce()
  }, 2000)
}

export function stopAlarm() {
  if (loop !== null) window.clearInterval(loop)
  loop = null
  if ('vibrate' in navigator) navigator.vibrate(0)
}
