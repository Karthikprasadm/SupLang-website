"use client"

import { useRef, useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { toast } from "@/hooks/use-toast"
 

export default function Component() {
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mousePositionRef = useRef({ x: 0, y: 0 })
  const isTouchingRef = useRef(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const startTimeRef = useRef(0)
  const supBoundsRef = useRef({ minX: 0, minY: 0, maxX: 0, maxY: 0, pad: 28 })
  const [menuTop, setMenuTop] = useState<number | null>(null)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const updateCanvasSize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      setIsMobile(window.innerWidth < 768) // Set mobile breakpoint
    }

    updateCanvasSize()

    let particles: {
      x: number
      y: number
      baseX: number
      baseY: number
      startX: number
      startY: number
      size: number
      color: string
      scatteredColor: string
      life: number
      isAWS: boolean
      delay: number // seconds before movement toward base starts
      dur: number // seconds to fully reach target (before settling)
      twinklePhase: number
      gPhase: number
      gFreq: number
      gAmp: number
      dPhase: number
      dFreq: number
      dAmp: number
    }[] = []

    let textImageData: ImageData | null = null

    const updateMenuPosition = () => {
      const b = supBoundsRef.current
      if (b.maxY > b.minY && b.maxX > b.minX) {
        const top = Math.min(b.maxY + b.pad + 40, window.innerHeight - 56)
        setMenuTop(top)
      } else {
        setMenuTop(Math.round(window.innerHeight / 2 + 140))
      }
    }

    function createTextImage() {
      if (!ctx || !canvas) return 0

      ctx.fillStyle = "white"
      ctx.save()
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"

      const widthLimit = canvas.width * 0.88
      const heightLimit = canvas.height * (isMobile ? 0.55 : 0.62)

      const fontFamily = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"
      let fontSize = Math.min(canvas.width, canvas.height) * (isMobile ? 0.34 : 0.5)
      fontSize = Math.max(fontSize, 48)

      const setFont = () => (ctx.font = `800 ${Math.floor(fontSize)}px ${fontFamily}`)
      setFont()

      const measure = () => {
        const m = ctx.measureText("SUP!")
        const textWidth = m.width
        const textHeight = (m.actualBoundingBoxAscent ?? 0) + (m.actualBoundingBoxDescent ?? 0) || fontSize * 1.1
        return { textWidth, textHeight }
      }

      for (let guard = 0; guard < 500; guard++) {
        const { textWidth, textHeight } = measure()
        if (textWidth <= widthLimit && textHeight <= heightLimit) break
        fontSize -= 2
        if (fontSize <= 12) break
        setFont()
      }

      ctx.fillText("SUP!", canvas.width / 2, canvas.height / 2)
      ctx.restore()

      textImageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      return 1
    }

    function createParticle(scatter: boolean) {
      if (!ctx || !canvas || !textImageData) return null
      const data = textImageData.data

      for (let attempt = 0; attempt < 200; attempt++) {
        const tx = Math.floor(Math.random() * canvas.width)
        const ty = Math.floor(Math.random() * canvas.height)
        if (data[(ty * canvas.width + tx) * 4 + 3] > 128) {
          const startX = scatter ? Math.random() * canvas.width : tx
          const startY = scatter ? Math.random() * canvas.height : ty

          const dur = (isMobile ? 3.2 : 5.5) + Math.random() * (isMobile ? 1.4 : 2.0)
          const delay = (isMobile ? 0.8 : 1.2) + Math.random() * (isMobile ? 1.4 : 2.0)

          return {
            x: startX,
            y: startY,
            startX,
            startY,
            baseX: tx,
            baseY: ty,
            size: 0.8 + Math.random() * 0.9,
            color: "white",
            scatteredColor: "#00DCFF",
            isAWS: false,
            life: Math.random() * 140 + 120,
            delay,
            dur,
            twinklePhase: Math.random() * Math.PI * 2,
            gPhase: Math.random() * Math.PI * 2,
            gFreq: 2.2 + Math.random() * 1.6,
            gAmp: 0.8 + Math.random() * 1.6,
            dPhase: Math.random() * Math.PI * 2,
            dFreq: 0.25 + Math.random() * 0.35,
            dAmp: isMobile ? 3 + Math.random() * 4 : 5 + Math.random() * 7,
          }
        }
      }
      return null
    }

    function createInitialParticles(scatter: boolean) {
      const baseParticleCount = 12000
      const particleCount = Math.floor(baseParticleCount * Math.sqrt((canvas.width * canvas.height) / (1920 * 1080)))
      for (let i = 0; i < particleCount; i++) {
        const particle = createParticle(scatter)
        if (particle) particles.push(particle)
      }
      if (particles.length) {
        let minX = Number.POSITIVE_INFINITY,
          minY = Number.POSITIVE_INFINITY,
          maxX = Number.NEGATIVE_INFINITY,
          maxY = Number.NEGATIVE_INFINITY
        for (const p of particles) {
          if (p.baseX < minX) minX = p.baseX
          if (p.baseY < minY) minY = p.baseY
          if (p.baseX > maxX) maxX = p.baseX
          if (p.baseY > maxY) maxY = p.baseY
        }
        supBoundsRef.current = { minX, minY, maxX, maxY, pad: isMobile ? 24 : 32 }
        updateMenuPosition()
      }
    }

    let animationFrameId: number

    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t
    const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5)

    function animate() {
      if (!ctx || !canvas) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = "black"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const now = performance.now()
      const elapsed = (now - startTimeRef.current) / 1000

      const { x: mouseX, y: mouseY } = mousePositionRef.current
      const maxDistance = 220

      const b = supBoundsRef.current
      const pointerInsideSup =
        mouseX >= b.minX - b.pad && mouseX <= b.maxX + b.pad && mouseY >= b.minY - b.pad && mouseY <= b.maxY + b.pad

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        const tRaw = (elapsed - p.delay) / p.dur
        const t = clamp(tRaw, 0, 1)
        const eased = easeOutQuint(t)

        const timeSec = now / 1000
        const driftScale = 1 - eased

        let targetX = lerp(p.startX, p.baseX, eased)
        let targetY = lerp(p.startY, p.baseY, eased)

        targetX += Math.sin(timeSec * p.dFreq + p.dPhase) * p.dAmp * driftScale
        targetY += Math.cos(timeSec * (p.dFreq * 0.9) + p.dPhase * 1.13) * p.dAmp * driftScale

        if (pointerInsideSup) {
          const distToMouse = Math.hypot(p.baseX - mouseX, p.baseY - mouseY)
          const proximity = Math.max(0, 1 - distToMouse / 220)
          if (proximity > 0) {
            const amp = p.gAmp * proximity * eased
            targetX += Math.sin(timeSec * p.gFreq + p.gPhase) * amp
            targetY += Math.cos(timeSec * (p.gFreq * 0.9) + p.gPhase * 1.2) * amp
          }
        }

        const dx = mouseX - p.x
        const dy = mouseY - p.y
        const distance = Math.hypot(dx, dy)

        let desiredX = targetX
        let desiredY = targetY

        const interactive = (isTouchingRef.current || !("ontouchstart" in window)) && distance < maxDistance
        if (interactive) {
          const force = (maxDistance - distance) / maxDistance
          const angle = Math.atan2(dy, dx)
          const moveX = Math.cos(angle) * force * 60
          const moveY = Math.sin(angle) * force * 60
          desiredX = targetX - moveX
          desiredY = targetY - moveY
        }

        p.x += (desiredX - p.x) * (interactive ? 0.1 : 0.08)
        p.y += (desiredY - p.y) * (interactive ? 0.1 : 0.08)

        const twinkle = 0.65 + 0.35 * Math.sin(timeSec * (isMobile ? 1.6 : 2.2) + p.twinklePhase)

        ctx.fillStyle = `rgba(255,255,255,${twinkle})`
        ctx.fillRect(p.x, p.y, p.size, p.size)

        p.life--
        if (p.life <= 0) {
          const newParticle = createParticle(false)
          if (newParticle) {
            particles[i] = newParticle
          } else {
            particles.splice(i, 1)
            i--
          }
        }
      }

      const baseParticleCount = 12000
      const targetParticleCount = Math.floor(
        baseParticleCount * Math.sqrt((canvas.width * canvas.height) / (1920 * 1080)),
      )
      while (particles.length < targetParticleCount) {
        const newParticle = createParticle(false)
        if (newParticle) particles.push(newParticle)
      }

      animationFrameId = requestAnimationFrame(animate)
    }

    const scale = createTextImage()
    startTimeRef.current = performance.now()
    createInitialParticles(true)
    updateMenuPosition()
    animate()

    const handleResize = () => {
      updateCanvasSize()
      createTextImage()
      particles = []
      startTimeRef.current = performance.now()
      createInitialParticles(true)
      updateMenuPosition()
    }

    const handleMove = (x: number, y: number) => {
      mousePositionRef.current = { x, y }
    }

    const handleMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY)
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        e.preventDefault()
        handleMove(e.touches[0].clientX, e.touches[0].clientY)
      }
    }

    const handleTouchStart = () => {
      isTouchingRef.current = true
    }

    const handleTouchEnd = () => {
      isTouchingRef.current = false
      mousePositionRef.current = { x: 0, y: 0 }
    }

    const handleMouseLeave = () => {
      if (!("ontouchstart" in window)) {
        mousePositionRef.current = { x: 0, y: 0 }
      }
    }

    window.addEventListener("resize", handleResize)
    canvas.addEventListener("mousemove", handleMouseMove)
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false })
    canvas.addEventListener("mouseleave", handleMouseLeave)
    canvas.addEventListener("touchstart", handleTouchStart)
    canvas.addEventListener("touchend", handleTouchEnd)

    return () => {
      window.removeEventListener("resize", handleResize)
      canvas.removeEventListener("mousemove", handleMouseMove)
      canvas.removeEventListener("touchmove", handleTouchMove)
      canvas.removeEventListener("mouseleave", handleMouseLeave)
      canvas.removeEventListener("touchstart", handleTouchStart)
      canvas.removeEventListener("touchend", handleTouchEnd)
      cancelAnimationFrame(animationFrameId)
    }
  }, [isMobile])

  useEffect(() => {
    if (!isMenuOpen) return

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMenuOpen(false)
    }
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(target)
      ) {
        setIsMenuOpen(false)
      }
    }

    setTimeout(() => {
      const firstItem = menuRef.current?.querySelector('[role="menuitem"]') as HTMLButtonElement | null
      firstItem?.focus()
    }, 0)

    document.addEventListener("keydown", handleKey)
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("keydown", handleKey)
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isMenuOpen])

  return (
    <div className="relative w-full h-dvh flex flex-col items-center justify-center bg-black">
      <canvas
        ref={canvasRef}
        className="w-full h-full absolute top-0 left-0 touch-none"
        aria-label="Interactive particle effect forming the text SUP!"
      />
      <div
        className="absolute left-1/2 -translate-x-1/2 text-center z-10"
        style={menuTop != null ? { top: menuTop } : undefined}
      >
        
        {isMenuOpen ? (
          <div
            ref={menuRef}
            id="main-menu"
            role="menu"
            aria-labelledby="menu-button"
            className="mb-3 flex flex-col items-center gap-1"
          >
            
            <button
              role="menuitem"
              className="font-mono text-white text-xs sm:text-base md:text-sm px-3 py-1 rounded bg-black/60"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              toggle theme
            </button>
            <button
              role="menuitem"
              className="font-mono text-white text-xs sm:text-base md:text-sm px-3 py-1 rounded bg-black/60"
              onClick={() =>
                toast({
                  title: "Hello",
                  description: "This is a sample toast.",
                })
              }
            >
              show toast
            </button>
            <button
              role="menuitem"
              className="font-mono text-white text-xs sm:text-base md:text-sm px-3 py-1 rounded bg-black/60"
              onClick={() => setIsMenuOpen(false)}
            >
              Close
            </button>
          </div>
        ) : null}
        <button
          id="menu-button"
          ref={menuButtonRef}
          type="button"
          className="text-white text-xs sm:text-base md:text-sm uppercase"
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          aria-controls="main-menu"
          onClick={() => setIsMenuOpen((v) => !v)}
          style={{ fontFamily: '"Literature", serif' }}
        >
          MENU
        </button>
      </div>
    </div>
  )
}
