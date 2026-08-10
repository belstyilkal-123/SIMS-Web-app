# AgriSmart Irrigation System — Setup & Production Guide

## Project Structure

```
SAMART IRIGATION/
├── backend/              Node.js + Express + Socket.IO API
│   ├── esp8266/          Arduino firmware for the ESP8266 device
│   │   └── SmartIrrigation.ino
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── .env              Your secrets (never commit this)
│   ├── .env.example      Template — copy to .env
│   └── server.js
└── frontend/             React + Vite dashboard
    └── src/
```

---

## 1. Backend Setup

### Prerequisites
- Node.js >= 18
- MongoDB (local) **or** a MongoDB Atlas cluster

### Steps

```bash
cd backend
cp .env.example .env        # then edit .env with your values
npm install
node server.js              # development
```

For production use `pm2`:
```bash
npm install -g pm2
pm2 start server.js --name agrismart-api
pm2 save
```

---

## 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev                 # development (http://localhost:5173)
npm run build               # production build → dist/
```

To serve the production build, copy `dist/` to your web server (Nginx, Apache, or a static host like Vercel/Netlify).

---

## 3. SMTP Email (Forgot Password)

Without SMTP configured, the backend returns the reset URL directly in the API response (visible in the browser for development). In production you **must** configure SMTP.

Edit `backend/.env`:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM=AgriSmart <noreply@yourdomain.com>
```

For Gmail you need to generate an **App Password** (not your account password):  
Google Account → Security → 2-Step Verification → App Passwords.

---

## 4. Connecting a Real ESP8266 Device

### Flash the firmware

1. Open `backend/esp8266/SmartIrrigation.ino` in Arduino IDE.
2. Install required libraries via Library Manager:
   - **ArduinoJson** (≥ 6.x) by Benoit Blanchon
   - **DHT sensor library** by Adafruit
3. Select board: **NodeMCU 1.0 (ESP-12E Module)**.
4. Edit the configuration block at the top of the sketch:

```cpp
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL    = "http://192.168.1.100:5000"; // your server's LAN IP
const char* DEVICE_ID     = "AA:BB:CC:DD:EE:01";        // MAC address of this unit
const char* DEVICE_API_KEY = "same-value-as-backend-env"; // keep secret
```

5. Upload and open Serial Monitor at 115200 baud.

### How device connectivity works

| Event | Interval | Endpoint |
|-------|----------|----------|
| Heartbeat ping | Every 12 s | `POST /api/esp8266/heartbeat` |
| Full sensor data | Every 30 s | `POST /api/esp8266/data` |
| Server marks offline | After 30 s silence | Automatic (deviceStatusService) |

- If no heartbeat is received for **30 seconds**, the server marks the device **OFFLINE** and broadcasts a `device:status` WebSocket event.
- The dashboard and Devices page update in real time — all sensor readings show `--` and all controls are disabled until the device reconnects.

### First-time device registration

For security, the API accepts data only from devices registered by an administrator. To assign a device to a specific farm:

1. Register the farm first via the dashboard.
2. Flash the sketch with the correct `DEVICE_ID` (MAC address).
3. Register the device from the administrator Devices page or `POST /api/devices`.
4. Flash the firmware with the device ID and `DEVICE_API_KEY`, then power it on.
5. In the Devices page you can see it appear online within 30 seconds.

---

## 5. Hardware Wiring Reference

```
ESP8266 NodeMCU Pin  →  Component
────────────────────────────────────────────────
A0                   →  Soil Moisture Sensor (analog out)
D1 (GPIO5)           →  Water Level Float Sensor
D2 (GPIO4)           →  pH Sensor (analog via voltage divider)
D3 (GPIO0)           →  Water Pump Relay (active-low)
D4 (GPIO2)           →  Alarm Buzzer
D5 (GPIO14)          →  DHT11 Data Pin
3.3V / GND           →  Sensor VCC / GND
```

> **Relay wiring**: Most 5 V relay modules are active-low. Connect IN to D3, VCC to VIN (5 V), GND to GND. `LOW` signal = relay ON (pump runs).

---

## 6. Multi-Language Support

The system supports **English** and **Amharic (አማርኛ)**.

- Language can be changed from the **sidebar switcher** (instant, no page reload).
- The selected language is saved to the user's profile in MongoDB and synced across sessions.
- Public pages (Home, Login, Register) include a language selector in the top-right corner.

---

## 7. Production Checklist

- [ ] Change `JWT_SECRET` to a cryptographically random string (32+ chars)
- [ ] Set a separate, random `DEVICE_API_KEY` on the server and every deployed device
- [ ] Set `FRONTEND_URL` to your production domain
- [ ] Configure `SMTP_*` variables for real email delivery
- [ ] Use HTTPS in production (reverse proxy with Nginx + Let's Encrypt)
- [ ] Set `MONGODB_URI` to your Atlas cluster URI
- [ ] Set `NODE_ENV=production` in your environment
- [ ] Use `pm2` or a systemd service to keep the backend running
- [ ] Serve the frontend `dist/` folder via Nginx or a CDN

---

## 8. API Quick Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login, returns JWT |
| POST | `/api/auth/forgot-password` | Send password reset email |
| POST | `/api/auth/reset-password/:token` | Reset password with token |
| GET | `/api/auth/profile` | Get user profile (auth) |
| PUT | `/api/auth/profile` | Update profile & language (auth) |
| GET | `/api/farms` | List farms (auth) |
| GET | `/api/devices` | List devices (auth) |
| GET | `/api/devices/:id/status` | Real-time device status (auth) |
| POST | `/api/irrigation/manual` | Send pump/buzzer command (auth) |
| POST | `/api/esp8266/heartbeat` | Device heartbeat ping |
| POST | `/api/esp8266/data` | Submit sensor readings |
| GET | `/api/health` | Server health check |
