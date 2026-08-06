'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface AppleSpinnerProps extends React.SVGAttributes<SVGSVGElement> {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number
  className?: string
  color?: string
}

const sizeMap: Record<string, number> = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 28,
  xl: 36,
}

const sizeClassMap: Record<string, string> = {
  xs: 'size-3 w-3 h-3',
  sm: 'size-4 w-4 h-4',
  md: 'size-5 w-5 h-5',
  lg: 'size-7 w-7 h-7',
  xl: 'size-9 w-9 h-9',
}

export function AppleSpinner({
  size = 'md',
  className,
  color = 'currentColor',
  ...props
}: AppleSpinnerProps) {
  const pixelSize = typeof size === 'number' ? size : sizeMap[size] || 20
  const sizeClass = typeof size === 'string' ? sizeClassMap[size] || 'size-5' : ''

  // 12 spokes rotated at 30-degree intervals (Apple iOS Activity Indicator)
  const spokes = [
    { rotate: 0, opacity: 1 },
    { rotate: 30, opacity: 0.916 },
    { rotate: 60, opacity: 0.833 },
    { rotate: 90, opacity: 0.75 },
    { rotate: 120, opacity: 0.666 },
    { rotate: 150, opacity: 0.583 },
    { rotate: 180, opacity: 0.5 },
    { rotate: 210, opacity: 0.416 },
    { rotate: 240, opacity: 0.333 },
    { rotate: 270, opacity: 0.25 },
    { rotate: 300, opacity: 0.166 },
    { rotate: 330, opacity: 0.083 },
  ]

  return (
    <svg
      width={pixelSize}
      height={pixelSize}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('animate-apple-spin shrink-0', sizeClass, className)}
      aria-label="Loading"
      role="status"
      {...props}
    >
      {spokes.map((spoke, i) => (
        <rect
          key={i}
          x="10.85"
          y="1.5"
          width="2.3"
          height="6"
          rx="1.15"
          fill={color}
          opacity={spoke.opacity}
          transform={`rotate(${spoke.rotate} 12 12)`}
        />
      ))}
    </svg>
  )
}

/**
 * Apple-style frosted glass loading card/hud for modals or page sections
 */
export function AppleLoadingCard({
  message = 'Loading...',
  subtext,
  className,
}: {
  message?: string
  subtext?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 rounded-2xl bg-white/75 dark:bg-zinc-900/75 backdrop-blur-xl border border-white/60 dark:border-zinc-800 shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all duration-300 animate-in fade-in zoom-in-95',
        className
      )}
    >
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-slate-100 to-slate-200/80 dark:from-zinc-800 dark:to-zinc-800/80 flex items-center justify-center shadow-inner mb-4">
        <AppleSpinner size="lg" className="text-indigo-600 dark:text-indigo-400" />
      </div>
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 tracking-tight">
        {message}
      </p>
      {subtext && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 text-center max-w-xs">
          {subtext}
        </p>
      )}
    </div>
  )
}

