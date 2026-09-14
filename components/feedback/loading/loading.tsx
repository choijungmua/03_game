"use client";

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib"
import { Progress } from "@/components/feedback/progress"
import { LoadingProps } from "./type"
import { DEFAULT } from "./constants"

const FRAME_SRC = (frame: string) => `/assets/images/characters/capybara/capybara-${frame}-right.webp`
/** 로비 걷기와 같은 순서: walk1 → stand → walk2 → stand */
const WALK_ORDER = [0, 1, 2, 1] as const
const FRAMES = ["walk1", "stand", "walk2"] as const

export function Loading({
  className,
  size = DEFAULT.SIZE,
  fullScreen = DEFAULT.FULL_SCREEN,
  description,
  progress,
  ...props
}: LoadingProps) {
  const [tick, setTick] = useState(0)
  // progress를 안 넘기면 90%까지 점점 느리게 차오른다 (끝은 실제 완료 때 화면이 넘어가며 처리)
  const [fake, setFake] = useState(0)

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const id = setInterval(() => {
      if (!reduced) setTick((t) => t + 1)
      setFake((v) => v + (DEFAULT.FAKE_MAX - v) * 0.04)
    }, DEFAULT.FRAME_MS)
    return () => clearInterval(id)
  }, [])

  const value = Math.round(progress ?? fake)
  const frame = WALK_ORDER[tick % WALK_ORDER.length]

  const content = (
    <div
      role="status"
      className={cn("flex flex-col items-center justify-center gap-3", className)}
      {...props}
    >
      <div className="relative" style={{ width: size, height: size }} aria-hidden>
        {/* 세 프레임을 모두 올려두고 보이는 것만 바꿔서 프레임 전환 때 깜빡이지 않게 한다 */}
        {FRAMES.map((name, i) => (
          <Image
            key={name}
            src={FRAME_SRC(name)}
            alt=""
            fill
            unoptimized
            priority
            draggable={false}
            className={cn("select-none object-contain", i !== frame && "invisible")}
          />
        ))}
      </div>
      <Progress
        size="sm"
        value={value}
        aria-label="불러오는 중"
        style={{ width: `calc(${typeof size === "number" ? `${size}px` : size} * 1.5)` }}
      />
      {description && (
        <p className="text-sm text-alternative font-medium text-center">
          {description}
        </p>
      )}
    </div>
  )

  if (fullScreen) {
    if (typeof window === "undefined") return null;

    return createPortal(
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed top-0 left-0 right-0 bottom-0 z-max h-dvh w-screen flex items-center justify-center bg-background/80 backdrop-blur-md touch-none"
        >
          {content}
        </motion.div>
      </AnimatePresence>,
      document.body
    )
  }

  return content
}
