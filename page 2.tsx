import { CandyGame } from "@/components/candy-game";

export default function Home() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-black text-white">
      <div aria-hidden className="bg-glow pointer-events-none absolute inset-x-0 top-0 h-[520px]" />
      <div aria-hidden className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-[640px]" />

      <header className="relative mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
            <defs>
              <linearGradient id="logo" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#5aa9ff" />
                <stop offset="1" stopColor="#ff4fa3" />
              </linearGradient>
            </defs>
            <path
              d="M12 2.5 22 20H2L12 2.5Z"
              fill="url(#logo)"
              stroke="url(#logo)"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-[15px] font-medium tracking-tight">Prism</span>
        </div>
      </header>

      <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center px-5 pb-20 pt-8 sm:pt-14">
        <h1 className="animate-rise bg-gradient-to-b from-white to-white/45 bg-clip-text text-center text-4xl font-semibold tracking-tighter text-balance text-transparent sm:text-6xl">
          Match three. Chain the rest.
        </h1>
        <p className="animate-rise mt-4 max-w-md text-center text-[15px] leading-6 text-balance text-neutral-400 [animation-delay:80ms] sm:text-base">
          Swap neighbouring tiles to line up three or more. Every cascade multiplies your score.
        </p>

        <div className="animate-rise mt-10 w-full [animation-delay:160ms] sm:mt-14">
          <CandyGame />
        </div>
      </div>
    </main>
  );
}
