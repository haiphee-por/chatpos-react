import { useEffect, useRef, useState } from 'react'

export type ThaiVoiceStatus = 'idle' | 'ready' | 'speaking' | 'unsupported' | 'error'

const thaiDigits = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า']
const thaiPlaces = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน']
const thaiDigitClips = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
const thaiPlaceClips = ['', 'ten', 'hundred', 'thousand', 'ten_thousand', 'hundred_thousand']

const keySpeech: Record<string, { text: string; clip: string }> = {
  '0': { text: 'ศูนย์', clip: 'zero' },
  '1': { text: 'หนึ่ง', clip: 'one' },
  '2': { text: 'สอง', clip: 'two' },
  '3': { text: 'สาม', clip: 'three' },
  '4': { text: 'สี่', clip: 'four' },
  '5': { text: 'ห้า', clip: 'five' },
  '6': { text: 'หก', clip: 'six' },
  '7': { text: 'เจ็ด', clip: 'seven' },
  '8': { text: 'แปด', clip: 'eight' },
  '9': { text: 'เก้า', clip: 'nine' },
  '00': { text: 'ศูนย์ ศูนย์', clip: 'zero' },
  '.': { text: 'จุด', clip: 'point' },
  '+': { text: 'บวก', clip: 'plus' },
  '-': { text: 'ลบ', clip: 'minus' },
  '*': { text: 'คูณ', clip: 'multiply' },
  '/': { text: 'หาร', clip: 'divide' },
  '=': { text: 'เท่ากับ', clip: 'exact' },
  'ล้าง': { text: 'ล้างยอด', clip: 'clear' },
  'ลบ': { text: 'ลบหนึ่งหลัก', clip: 'backspace' },
}

const methodClips: Record<string, string> = {
  promptpay: 'create_qr',
  truemoney: 'open_truemoney',
  visa_th: 'open_visa',
  visa_int: 'open_visa',
  wechat: 'open_wechat',
  linepay: 'open_mobile',
  alipay: 'open_alipay',
  shopeepay: 'open_shopeepay',
}

function isLineEnvironment() {
  if (typeof window === 'undefined') return false
  const query = new URLSearchParams(window.location.search)
  return /\bline\//i.test(window.navigator.userAgent) || query.get('openExternalBrowser') === '1' || query.get('line') === '1'
}

function clipUrl(clip: string) {
  return `/audio/th/${clip}.mp3?v=8`
}

function thaiInteger(value: number): string {
  const safeValue = Math.max(0, Math.floor(value))
  if (safeValue === 0) return thaiDigits[0]
  if (safeValue >= 1_000_000) {
    const millions = Math.floor(safeValue / 1_000_000)
    const remainder = safeValue % 1_000_000
    return `${thaiInteger(millions)}ล้าน${remainder ? thaiInteger(remainder) : ''}`
  }
  const digits = String(safeValue).split('').map(Number)
  return digits.map((digit, index) => {
    if (digit === 0) return ''
    const place = digits.length - index - 1
    if (place === 1) return `${digit === 1 ? '' : digit === 2 ? 'ยี่' : thaiDigits[digit]}สิบ`
    if (place === 0 && digit === 1 && digits.length > 1) return 'เอ็ด'
    return `${thaiDigits[digit]}${thaiPlaces[place]}`
  }).join('')
}

function thaiIntegerVoiceClips(value: number): string[] {
  const safeValue = Math.max(0, Math.floor(value))
  if (safeValue === 0) return [thaiDigitClips[0]]
  if (safeValue >= 1_000_000) {
    const millions = Math.floor(safeValue / 1_000_000)
    const remainder = safeValue % 1_000_000
    return [...thaiIntegerVoiceClips(millions), 'million', ...(remainder ? thaiIntegerVoiceClips(remainder) : [])]
  }
  const digits = String(safeValue).split('').map(Number)
  return digits.flatMap((digit, index) => {
    if (digit === 0) return []
    const place = digits.length - index - 1
    if (place === 1) return [...(digit === 1 ? [] : [digit === 2 ? 'yi' : thaiDigitClips[digit]]), 'ten']
    if (place === 0 && digit === 1 && digits.length > 1) return ['et']
    return [thaiDigitClips[digit], ...(thaiPlaceClips[place] ? [thaiPlaceClips[place]] : [])]
  })
}

export function thaiMoneyText(value: number) {
  const totalSatang = Math.max(0, Math.round(value * 100))
  const baht = Math.floor(totalSatang / 100)
  const satang = totalSatang % 100
  return satang ? `${thaiInteger(baht)}บาท ${thaiInteger(satang)}สตางค์` : `${thaiInteger(baht)}บาทถ้วน`
}

export function thaiMoneyVoiceClips(value: number) {
  const totalSatang = Math.max(0, Math.round(value * 100))
  const baht = Math.floor(totalSatang / 100)
  const satang = totalSatang % 100
  return [...thaiIntegerVoiceClips(baht), 'baht', ...(satang ? [...thaiIntegerVoiceClips(satang), 'satang'] : ['exact'])]
}

export function useThaiVoice(initialEnabled = true) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [status, setStatus] = useState<ThaiVoiceStatus>('idle')
  const [lineMode, setLineMode] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const runRef = useRef(0)

  useEffect(() => {
    setLineMode(isLineEnvironment())
    return () => {
      runRef.current += 1
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
      audioRef.current?.pause()
    }
  }, [])

  const cancel = () => {
    runRef.current += 1
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.onended = null
      audioRef.current.onerror = null
    }
    setStatus('ready')
  }

  const playClips = (clips: string[], onEnd?: () => void) => {
    const runId = ++runRef.current
    const audio = audioRef.current ?? new Audio()
    audioRef.current = audio
    audio.preload = 'auto'
    audio.volume = 1
    audio.playbackRate = 1.18
    audio.setAttribute('playsinline', 'true')
    let index = 0
    const finish = (success: boolean) => {
      if (runRef.current !== runId) return
      setStatus(success ? 'ready' : 'error')
      onEnd?.()
    }
    const next = () => {
      if (runRef.current !== runId) return
      const clip = clips[index++]
      if (!clip) return finish(true)
      audio.src = clipUrl(clip)
      audio.currentTime = 0
      audio.playbackRate = 1.18
      audio.onplaying = () => setStatus('speaking')
      audio.onended = next
      audio.onerror = () => finish(false)
      audio.load()
      void audio.play().catch(() => finish(false))
    }
    next()
  }

  const speak = (text: string, clips: string[] = ['test'], onEnd?: () => void, force = false) => {
    if (!enabled && !force) {
      onEnd?.()
      return
    }
    if (lineMode) {
      playClips(clips, onEnd)
      return
    }
    if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance !== 'function') {
      setStatus('unsupported')
      onEnd?.()
      return
    }
    const runId = ++runRef.current
    const synth = window.speechSynthesis
    const start = () => {
      if (runRef.current !== runId) return
      const utterance = new window.SpeechSynthesisUtterance(text)
      utterance.lang = 'th-TH'
      utterance.rate = 1.05
      utterance.pitch = 1
      utterance.volume = 1
      utterance.voice = synth.getVoices().find((voice) => voice.lang.toLowerCase().startsWith('th')) || null
      utterance.onstart = () => setStatus('speaking')
      utterance.onend = () => { if (runRef.current === runId) { setStatus('ready'); onEnd?.() } }
      utterance.onerror = () => { if (runRef.current === runId) { setStatus('error'); onEnd?.() } }
      synth.speak(utterance)
    }
    if (synth.speaking || synth.pending) {
      synth.cancel()
      window.setTimeout(start, 60)
    } else {
      start()
    }
  }

  const toggle = () => {
    if (enabled) {
      cancel()
      setEnabled(false)
      setStatus('idle')
      return
    }
    setEnabled(true)
    window.setTimeout(() => speak('เปิดเสียงภาษาไทยแล้ว', ['voice_on'], undefined, true), 0)
  }

  const test = () => speak('ทดสอบเสียงภาษาไทย หนึ่ง สอง สาม ระบบพร้อมใช้งาน', ['test'])
  const speakKey = (key: string) => {
    const entry = keySpeech[key]
    if (entry) speak(entry.text, key === '00' ? ['zero', 'zero'] : [entry.clip])
  }
  const speakPaymentTotal = (amount: number, method: string, methodId?: string, onEnd?: () => void) => {
    speak(`ยอดชำระ ${thaiMoneyText(amount)} กรุณาตรวจสอบยอด ${method}`, ['payment_total', ...thaiMoneyVoiceClips(amount), 'please_check', methodClips[methodId || 'promptpay'] || 'create_qr'], onEnd)
  }
  const speakMethod = (methodId: string, label: string) => speak(label, [methodClips[methodId] || 'test'])
  const speakPaymentComplete = (amount: number) => speak(`ชำระยอด ${thaiMoneyText(amount)} เรียบร้อยค่ะ`, ['paid_amount', ...thaiMoneyVoiceClips(amount), 'completed_female'])
  const speakOrderComplete = () => speak('ส่งออเดอร์เรียบร้อยแล้ว กรุณารอร้านรับออเดอร์ค่ะ', ['completed_female'])

  return { enabled, status, lineMode, cancel, toggle, test, speak, speakKey, speakMethod, speakPaymentTotal, speakPaymentComplete, speakOrderComplete }
}
