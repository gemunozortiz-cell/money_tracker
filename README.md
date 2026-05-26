# Control de Portafolio

Tu portafolio financiero personal en un solo lugar: instrumentos de tasa diaria (Nu, CETES, Revolut, etc.), tarjetas de crédito con calendario de pagos, Bitcoin en vivo, acciones e índices reales, noticias financieras y consejos personalizados de IA.

**Diseñado para iPhone / PWA**, también funciona en escritorio.

---

## Instalación (Windows)

### 1) Instala Node.js
Descarga la LTS desde https://nodejs.org/ (cualquier versión 18+). Acepta el instalador con defaults; reinicia tu terminal después.

Verifica:
```powershell
node --version
npm --version
```

### 2) Instala dependencias
```powershell
cd C:\Users\Usuario\control-de-portafolio
npm install
```

### 3) Configura tu API key de Gemini (opcional pero recomendado)
Crea un archivo `.env` en la raíz del proyecto:
```
GEMINI_API_KEY=tu_api_key_aqui
```

Consigue una **gratis** en https://aistudio.google.com/apikey (Google Cloud — incluye tier free generoso).

Sin la key, los consejos de IA caen a un fallback local pre-escrito.

### 4) Corre la app
```powershell
npm run dev
```
Abre http://localhost:3000 en tu navegador.

---

## Acceso desde tu iPhone

Tres opciones, de más simple a más completa:

### Opción A — Red local (gratis, solo en tu wifi)
1. Encuentra la IP local de tu PC: `ipconfig` → busca "IPv4" (ej. `192.168.1.50`).
2. En tu iPhone (mismo wifi), abre Safari: `http://192.168.1.50:3000`.
3. Toca **Compartir → Añadir a pantalla de inicio**. Ya tienes la app.

> Limitación: solo funciona cuando estás en casa con la PC encendida.

### Opción B — Tailscale (gratis, desde cualquier lugar)
1. Instala Tailscale en tu PC y tu iPhone (https://tailscale.com/).
2. Loguea ambos con la misma cuenta.
3. Desde tu iPhone, usa la IP de tu PC en la red Tailscale (ej. `100.x.x.x:3000`).
4. Añade a pantalla de inicio igual que en la opción A.

> Privado, sin abrir puertos, funciona fuera de casa con 4G/5G.

### Opción C — Deploy en la nube (gratis con límites)
- **Render.com**: conecta tu repo de GitHub, build command `npm run build`, start command `npm start`. Plan free tier.
- **Railway.app**: similar, despliegues automáticos.
- **Fly.io**: más control, requiere CLI.

Recuerda configurar `GEMINI_API_KEY` como variable de entorno del servicio.

---

## Build de producción

```powershell
npm run build
npm start
```
La app se sirve desde `dist/` con Express en el puerto 3000.

---

## Estructura

```
control-de-portafolio/
├── server.ts                 # Express: APIs (BTC, FX, stocks, news, IA)
├── src/
│   ├── App.tsx               # Layout principal con bottom tab bar
│   ├── hooks/
│   │   ├── usePortfolioState.ts   # State + interés compuesto día a día
│   │   └── useLiveData.ts         # Hooks de datos en vivo
│   └── components/
│       ├── HomeDashboard.tsx      # Pantalla de inicio con alertas
│       ├── BottomTabBar.tsx       # Navegación tipo app nativa
│       ├── InstrumentCard.tsx
│       ├── BitcoinTracker.tsx
│       ├── CustomInvestmentsTracker.tsx
│       ├── CreditCardsTracker.tsx
│       ├── MarketsAndNews.tsx
│       ├── GeminiAdvisor.tsx
│       └── PortfolioCharts.tsx
└── public/
    ├── manifest.webmanifest  # PWA manifest
    ├── sw.js                 # Service worker (offline cache)
    └── icon.svg              # Icono de la app
```

---

## APIs externas (todas gratis, sin key)

| Dato | Fuente | Cache backend |
|---|---|---|
| BTC/MXN, BTC/USD | CoinGecko | 30s |
| USD/MXN | exchangerate.host + open-er-api fallback | 5 min |
| Acciones (SPY, AAPL, NVDA, etc.) | Yahoo Finance unofficial | 60s (mercado abierto), 5 min (cerrado) |
| Noticias | RSS de CoinDesk, Bloomberg, Investing, El Economista | 10 min |
| IA | Google Gemini 2.5 Flash (requiere key) | — |

---

## Datos y privacidad

Todo tu portafolio vive en `localStorage` de tu navegador. **Nada sale a la nube.**

Usa el botón **Ajustes → Exportar JSON** para hacer un respaldo regularmente; con **Importar JSON** lo restauras (ideal antes de borrar caché, cambiar de equipo, etc.).
