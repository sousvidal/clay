function ClayLogoShapes({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      width="80"
      height="80"
      viewBox="30 30 140 145"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="layer1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
        <linearGradient id="layer2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id="layer3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>

      <g transform="translate(100,100) scale(0.82) translate(-100,-100)">
        <g transform="translate(-17.5, -8)">
          <path
            d="M 145 50 C 165 50, 180 65, 180 85 L 180 115 C 180 135, 165 150, 145 150 L 90 150 C 70 150, 55 135, 55 115 L 55 85 C 55 65, 70 50, 90 50 L 145 50 Z M 142 72 L 93 72 C 84 72, 78 78, 78 87 L 78 113 C 78 122, 84 128, 93 128 L 142 128 C 151 128, 157 122, 157 113 L 157 87 C 157 78, 151 72, 142 72 Z"
            fill="url(#layer3)"
            transform="translate(0, 16)"
          />
          <path
            d="M 145 50 C 165 50, 180 65, 180 85 L 180 115 C 180 135, 165 150, 145 150 L 90 150 C 70 150, 55 135, 55 115 L 55 85 C 55 65, 70 50, 90 50 L 145 50 Z M 142 72 L 93 72 C 84 72, 78 78, 78 87 L 78 113 C 78 122, 84 128, 93 128 L 142 128 C 151 128, 157 122, 157 113 L 157 87 C 157 78, 151 72, 142 72 Z"
            fill="url(#layer2)"
            transform="translate(0, 8)"
          />
          <path
            d="M 145 50 C 165 50, 180 65, 180 85 L 180 115 C 180 135, 165 150, 145 150 L 90 150 C 70 150, 55 135, 55 115 L 55 85 C 55 65, 70 50, 90 50 L 145 50 Z M 142 72 L 93 72 C 84 72, 78 78, 78 87 L 78 113 C 78 122, 84 128, 93 128 L 142 128 C 151 128, 157 122, 157 113 L 157 87 C 157 78, 151 72, 142 72 Z"
            fill="url(#layer1)"
          />
        </g>
      </g>
    </svg>
  )
}

export function EditorWelcome(): React.JSX.Element {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center">
        <div className="relative mb-8">
          <div className="absolute -inset-8 rounded-full bg-gradient-to-b from-blue-500/[0.06] to-violet-500/[0.03] blur-2xl" />
          <ClayLogoShapes className="relative drop-shadow-[0_0_24px_rgba(59,130,246,0.1)]" />
        </div>

        <h1 className="mb-1.5 text-xl font-semibold tracking-tight text-foreground">Clay</h1>
        <p className="mb-10 text-[13px] text-muted-foreground">Code, shaped by intent</p>

        <div className="flex flex-col gap-3 text-[13px]">
          <div className="flex items-center gap-3 text-muted-foreground">
            <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[11px]">
              ⌘B
            </kbd>
            <span>Toggle sidebar</span>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[11px]">
              ⌘P
            </kbd>
            <span>Quick open</span>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[11px]">
              ⌘⇧P
            </kbd>
            <span>Command palette</span>
          </div>
        </div>
      </div>
    </div>
  )
}
