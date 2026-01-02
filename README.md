# Smart Physics Ball Dashboard

A real-time physics dashboard for my final summative physics class project. It connects to the Smart Physics Ball and streams IMU data over WebSockets.

## What it does
- Live IMU charts (acceleration, rotation, velocity, impact)
- Orientation view (3D cube)
- Snapshot and CSV export
- Compare two throws
- Peak detection with alert
- Debug mode with realistic simulated data

## Tech stack
- React 18 + Vite
- Tailwind CSS
- Framer Motion
- VisX charts
- Lucide icons

## Quick start
```bash
npm install
npm run dev
```

## WebSocket data format
The app expects JSON packets like:
```json
{
  "accel": { "x": 0.12, "y": -9.81, "z": 1.2 },
  "gyro": { "x": 0.03, "y": 0.02, "z": 1.55 },
  "velocity": 3.21,
  "impact": 14.5,
  "timestamp": 17123456789
}
```

## Config
Update `src/config.js`:
- `DEBUG_MODE: true` uses fake data (no Arduino needed)
- `DEBUG_MODE: false` uses the WebSocket URL
- `WEBSOCKET_URL` can be overridden by `VITE_WEBSOCKET_URL`

## Deploy to Vercel
1. Push this repo to GitHub.
2. Import into Vercel.
3. Set environment variable:
   - `VITE_WEBSOCKET_URL=wss://your-websocket-host.example.com`
4. In `src/config.js`, set `DEBUG_MODE: false`.
5. Deploy.

Important: Vercel cannot host WebSocket servers. You must host the WebSocket server elsewhere and connect with **wss://**.

See `WEBSOCKET_SETUP.md` for hosting options and step-by-step setup.

## Build
```bash
npm run build
```

## License
MIT
