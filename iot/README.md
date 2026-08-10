# IoT System Foundation (Phase 2)

This directory contains the firmware and documentation for the ESP32 hardware used in the Smart Irrigation System.

## Hardware Components
- ESP32 Microcontroller
- Capacitive Soil Moisture Sensor (Analog)
- DHT22 Temperature/Humidity Sensor
- Ultrasonic Water Level Sensor
- Water Flow Sensor
- Relay Module & 12V Water Pump

## MQTT Communication Protocol
We use MQTT for low-latency, bidirectional communication between the ESP32 and the Node.js backend.

### Topics

**1. Telemetry Data (ESP32 -> Server)**
*   `farm/{farmId}/device/{deviceId}/telemetry`
    *   **Payload (JSON)**: `{"moisture": 45, "temp": 24, "humidity": 60, "tankLevel": 80}`
    *   **Frequency**: Every 5 minutes or on significant change.

**2. Commands (Server -> ESP32)**
*   `farm/{farmId}/device/{deviceId}/command`
    *   **Payload (JSON)**: `{"action": "PUMP_ON", "commandId": "12345"}`
    *   **Actions**: `PUMP_ON`, `PUMP_OFF`, `REBOOT`

**3. Acknowledgements (ESP32 -> Server)**
*   `farm/{farmId}/device/{deviceId}/ack`
    *   **Payload (JSON)**: `{"commandId": "12345", "status": "success"}`

## Offline Buffering
If Wi-Fi is unavailable, the ESP32 will buffer telemetry data locally (using SPIFFS or LittleFS) and batch-publish when the connection is restored.

## Security
- Device authentication is handled via a unique token embedded in the firmware.
- MQTT connections should ideally use MQTTS (TLS/SSL) in production.
