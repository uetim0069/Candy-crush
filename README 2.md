# Prism – a match-three game

Next.js (App Router) + Tailwind CSS v4, styled after Vercel's dark, hairline-border look with Geist.

## Run it

```bash
npx create-next-app@latest prism --ts --tailwind --eslint --app --import-alias "@/*"
cd prism
```

Copy these files over the generated ones:

- `app/globals.css`, `app/layout.tsx`, `app/page.tsx`
- `components/candy-game.tsx`
- `lib/game.ts`, `lib/cn.ts`

Then `npm run dev` and open http://localhost:3000.

## Tweak it

- `lib/game.ts`: `SIZE`, `KINDS`, `MOVES` and `GOAL` control board size, tile variety and difficulty.
- `components/candy-game.tsx`: `PALETTE` holds the gem colours (each type also has a distinct shape).
