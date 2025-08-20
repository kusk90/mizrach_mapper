# Mizrach Mapper

A simple web app: enter any address, see a 1-mile radius and a line pointing toward Jerusalem (choose Great‑circle or Rhumb).

## Local dev
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```
The static site will be in `dist/`.

## Deploy
- **Vercel**: New Project → Import → connect repo OR drag the folder. Framework: Vite. Build: `npm run build`. Output: `dist`.
- **Netlify**: New site → Import from Git → Build: `npm run build`, Publish dir: `dist`.
- **GitHub Pages**: Use `vite` + `gh-pages` (optional), or host `dist/` on any static host.
