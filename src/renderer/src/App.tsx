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

function App(): React.JSX.Element {
  return (
    <div className="relative flex h-screen w-screen select-none flex-col overflow-hidden bg-[#08090c]">
      <div className="absolute top-0 right-0 left-0 z-10 h-8 [-webkit-app-region:drag]" />

      {/* Ambient gradient orbs — echo the logo's cyan / blue / violet palette */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute top-[28%] left-1/2 h-[500px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#3b82f6]/[0.04] blur-[140px]" />
        <div className="absolute top-[58%] left-[28%] h-[350px] w-[450px] rounded-full bg-[#8b5cf6]/[0.03] blur-[120px]" />
        <div className="absolute top-[22%] right-[18%] h-[250px] w-[300px] rounded-full bg-[#06b6d4]/[0.025] blur-[100px]" />
      </div>

      <div className="relative flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center">
          {/* Logo with soft bloom halo */}
          <div className="relative mb-10 animate-fade-in">
            <div className="absolute -inset-8 rounded-full bg-gradient-to-b from-blue-500/[0.08] to-violet-500/[0.04] blur-2xl" />
            <ClayLogoShapes className="relative drop-shadow-[0_0_24px_rgba(59,130,246,0.12)]" />
          </div>

          <h1 className="mb-1.5 animate-fade-in text-[28px] font-semibold tracking-[-0.02em] text-white [animation-delay:80ms]">
            Clay
          </h1>

          <p className="mb-16 animate-fade-in text-[13px] font-medium text-white/25 [animation-delay:160ms]">
            Code, shaped by intent
          </p>

          <div className="animate-fade-in [animation-delay:300ms]">
            <div className="h-px w-24 overflow-hidden rounded-full bg-white/[0.08]">
              <div className="h-full w-1/3 animate-shimmer rounded-full bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 justify-center pb-5">
        <span className="animate-fade-in text-[11px] tabular-nums text-white/[0.12] [animation-delay:500ms]">
          v0.1.0
        </span>
      </div>
    </div>
  )
}

export default App
