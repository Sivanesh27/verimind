# VeriMind web app

React 18 + Vite single-page app for the VeriMind trust-aware agent.

```bash
cp .env.example .env   # VITE_API_URL, VITE_GOOGLE_CLIENT_ID
npm install
npm run dev            # http://localhost:5173
npm run build          # dist/
```

```
src/
├── main.jsx           providers (Router → Auth → Socket)
├── App.jsx            routes and guards
├── context/           AuthContext, SocketContext (+ useSocketEvent)
├── lib/               api client, socket, formatting
├── components/        layout/, agent/, auth/, ui/
├── pages/             Landing, auth/*, Agent, History, Monitor, Evaluation, Review, Admin
└── styles/global.css  design tokens and styles
```

Deployed on Vercel with `vercel.json` (SPA rewrites). See [deployment.md](../deployment.md).
