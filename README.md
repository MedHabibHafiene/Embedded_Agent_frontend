# STM32 Firmware Agent — Web Console

The single-page console for the [EmbeddedAgent](https://github.com/MedHabibHafiene/Embedded_Agent)
backend: describe firmware in plain English, watch it get generated, compile-checked and
flashed onto a real **STM32F4-Discovery** board — and inspect exactly what it configured.

React 18 · TypeScript · Vite

## Features

- **Natural-language command editor** — example commands one click away,
  `Ctrl+Enter` to submit, optional auto-confirm mode.
- **Source Code viewer** — syntax-highlighted generated `main.c` with copy/download,
  a hardware summary (SYSCLK, HCLK, APB1/APB2, USB, PLL registers), and a
  drag handle to resize the whole component like a textarea.
- **Hardware visualization** — what the generated code actually configures:
  onboard LEDs (lit/unlit), user button, the full clock tree with bus-limit
  warnings, every GPIO pin, and the pins used by the current project.
- **Build Logs** — streaming PlatformIO compile/flash output.
- **Docs Chat** — ask the STM32F4 documentation anything; answers are grounded
  in the backend's RAG index and keep their session history.
- **Jobs history** — every generation survives restarts; load any previous
  job and re-flash it.
- **Safe flashing** — a pre-flight confirmation dialog (ST-LINK detected, MCU
  ID verified, port picker) gates every write to the board. Auto-confirm can
  skip the dialog, never the checks.

## Getting started

```bash
# 0. Prereq: Node 18+, and the EmbeddedAgent backend running on
#    http://localhost:8000 (see the backend repo's quick start).

# 1. Install
npm install

# 2. Configure (optional — the dev proxy makes the defaults work)
copy .env.example .env

# 3. Run
npm run dev          # http://localhost:5173
```

### Backend connection

In development every API call goes same-origin and the Vite dev proxy
forwards it to the backend — no CORS to think about:

| Path                  | Proxied to            |
| --------------------- | --------------------- |
| `/api/*`              | `http://localhost:8000` |
| `/health`             | `http://localhost:8000` |
| `/generate-and-flash` | `http://localhost:8000` |

`.env` options (see `.env.example`):

| Variable               | Default   | Purpose                                                       |
| ---------------------- | --------- | ------------------------------------------------------------- |
| `VITE_API_BASE_URL`    | *(empty)* | Backend base URL; set only for a CORS-whitelisted production origin |
| `VITE_REQUEST_TIMEOUT` | `300000`  | Request timeout in ms — generation + compile can take minutes |

### Production build

```bash
npm run build        # outputs dist/
npm run preview      # serve the built bundle locally
```

Serving the built bundle from a different origin than the backend? Set
`VITE_API_BASE_URL` at build time and whitelist that origin in the backend's
CORS configuration.

## Project structure

```
src/
├── pages/
│   └── FirmwareAgentPage.tsx      the console (header, panels, tabs, modals)
├── components/
│   ├── CommandEditor.tsx          prompt editor + Auto-confirm / Flash / Generate
│   ├── FirmwareCodeViewer.tsx     highlighted main.c + hardware summary (resizable)
│   ├── HardwareStatePanel.tsx     LEDs, clock tree, GPIO table, peripherals
│   ├── OperationProgress.tsx      step-by-step pipeline status
│   ├── BuildLog.tsx               compile/flash output
│   ├── ChatPanel.tsx              documentation chat UI
│   ├── FirmwareHistory.tsx        persistent job history
│   ├── FlashConfirmationDialog.tsx pre-flight checklist + port picker
│   └── BackendStatus.tsx          live backend health indicator
├── api/                           typed fetch clients per endpoint group
├── types/firmware.ts              shared API contract types + board config
└── index.css                      design tokens (ST palette)
```

## Related

- **Backend** — the agent itself: RAG, generation, validation, PlatformIO
  build, OpenOCD flashing: [EmbeddedAgent](https://github.com/MedHabibHafiene/Embedded_Agent)
