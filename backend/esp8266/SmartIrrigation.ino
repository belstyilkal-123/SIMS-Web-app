/**
 * ============================================================
 * AgriSmart Irrigation System - ESP8266 Firmware
 * ============================================================
 *
 * Hardware wiring:
 *   A0  → Soil Moisture Sensor (analog)
 *   D1  → Water Level Sensor (digital)
 *   D2  → pH Sensor (analog via voltage divider)
 *   D3  → Water Pump Relay (LOW = ON for active-low relay)
 *   D4  → Alarm Buzzer
 *   D5  → DHT11 Data Pin (temperature & humidity)
 *
 * Dependencies (install via Arduino Library Manager):
 *   - ESP8266WiFi       (bundled with ESP8266 board package)
 *   - ESP8266HTTPClient (bundled with ESP8266 board package)
 *   - ArduinoJson       >= 6.x
 *   - DHT sensor library by Adafruit
 *
 * Board setup in Arduino IDE:
 *   Board: "NodeMCU 1.0 (ESP-12E Module)"
 *   Upload Speed: 115200
 *   Flash Size: 4MB (FS:2MB OTA:~1019KB)
 * ============================================================
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// ─── USER CONFIGURATION ──────────────────────────────────────
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Your backend server address (no trailing slash)
const char* SERVER_URL    = "http://192.168.1.100:5000";

// Unique identifier for this device (use MAC address format)
const char* DEVICE_ID     = "AA:BB:CC:DD:EE:01";

// Must match DEVICE_API_KEY in the backend .env file. Keep this out of source control.
const char* DEVICE_API_KEY = "CHANGE_THIS_TO_YOUR_DEVICE_API_KEY";

// Firmware version
const char* FIRMWARE_VER  = "1.0.4";
// ─────────────────────────────────────────────────────────────

// ─── PIN DEFINITIONS ─────────────────────────────────────────
#define MOISTURE_PIN   A0
#define WATER_LEVEL_PIN D1
#define PH_PIN         D2
#define PUMP_RELAY_PIN D3
#define BUZZER_PIN     D4
#define DHT_PIN        D5
#define DHT_TYPE       DHT11
// ─────────────────────────────────────────────────────────────

// ─── TIMING INTERVALS ────────────────────────────────────────
const unsigned long HEARTBEAT_INTERVAL_MS  = 12000;  // 12 seconds
const unsigned long SENSOR_SEND_INTERVAL_MS = 30000; // 30 seconds
// ─────────────────────────────────────────────────────────────

DHT dht(DHT_PIN, DHT_TYPE);

// State
String pumpStatus  = "OFF";
String buzzerStatus = "OFF";
unsigned long lastHeartbeatMs  = 0;
unsigned long lastSensorSendMs = 0;

// ─── SETUP ───────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Serial.println("\n[AgriSmart] Booting...");

  // Pin modes
  pinMode(PUMP_RELAY_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(WATER_LEVEL_PIN, INPUT);

  // Safe defaults — keep pump and buzzer OFF on boot
  digitalWrite(PUMP_RELAY_PIN, HIGH);  // HIGH = OFF for active-low relay
  digitalWrite(BUZZER_PIN, LOW);

  dht.begin();

  connectWiFi();
}

// ─── MAIN LOOP ───────────────────────────────────────────────
void loop() {
  // Reconnect Wi-Fi if dropped
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Disconnected. Reconnecting...");
    connectWiFi();
  }

  unsigned long now = millis();

  // Send heartbeat every 12 seconds (server marks offline after 30s)
  if (now - lastHeartbeatMs >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeatMs = now;
    sendHeartbeat();
  }

  // Send full sensor data every 30 seconds
  if (now - lastSensorSendMs >= SENSOR_SEND_INTERVAL_MS) {
    lastSensorSendMs = now;
    sendSensorData();
  }

  delay(100);
}

// ─── WI-FI CONNECTION ────────────────────────────────────────
void connectWiFi() {
  Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected!");
    Serial.print("[WiFi] IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WiFi] Connection failed. Will retry in next loop.");
  }
}

// ─── READ SENSORS ────────────────────────────────────────────
int readMoisture() {
  // Raw: 0 (wet) to 1023 (dry). Convert to % wet.
  int raw = analogRead(MOISTURE_PIN);
  int pct = map(raw, 1023, 0, 0, 100);
  pct = constrain(pct, 0, 100);
  Serial.printf("[Sensor] Moisture: %d%% (raw %d)\n", pct, raw);
  return pct;
}

float readTemperature() {
  float t = dht.readTemperature();
  if (isnan(t)) {
    Serial.println("[Sensor] DHT11 temperature read failed");
    return -999;
  }
  Serial.printf("[Sensor] Temperature: %.1f°C\n", t);
  return t;
}

float readHumidity() {
  float h = dht.readHumidity();
  if (isnan(h)) {
    Serial.println("[Sensor] DHT11 humidity read failed");
    return -999;
  }
  Serial.printf("[Sensor] Humidity: %.1f%%\n", h);
  return h;
}

float readPH() {
  // pH sensor outputs voltage 0–3.3V mapped to pH 0–14.
  // Calibrate offset and slope for your specific sensor module.
  int raw = analogRead(MOISTURE_PIN); // Switch MUX if using external ADC
  float voltage = raw * (3.3 / 1023.0);
  float ph = 3.5 * voltage + 0.0;    // Adjust slope & intercept after calibration
  ph = constrain(ph, 0.0, 14.0);
  Serial.printf("[Sensor] pH: %.2f (voltage %.2fV)\n", ph, voltage);
  return ph;
}

int readTankLevel() {
  // Float sensor: HIGH = water present, LOW = empty
  int state = digitalRead(WATER_LEVEL_PIN);
  int pct = (state == HIGH) ? 85 : 5; // Simple high/low; extend with multiple sensors
  Serial.printf("[Sensor] Tank Level: %d%%\n", pct);
  return pct;
}

int readBatteryLevel() {
  // ESP8266 doesn't have a second ADC; estimate or use voltage divider on A0
  // when moisture sensor is disconnected. Return 100 as placeholder.
  return 100;
}

// ─── HEARTBEAT ───────────────────────────────────────────────
void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClient wifiClient;
  HTTPClient http;

  String url = String(SERVER_URL) + "/api/esp8266/heartbeat";
  http.begin(wifiClient, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Api-Key", DEVICE_API_KEY);

  StaticJsonDocument<256> doc;
  doc["deviceId"]        = DEVICE_ID;
  doc["firmwareVersion"] = FIRMWARE_VER;
  doc["signalStrength"]  = WiFi.RSSI();
  doc["batteryLevel"]    = readBatteryLevel();

  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  if (code == 200) {
    Serial.println("[Heartbeat] OK");
  } else {
    Serial.printf("[Heartbeat] Failed, HTTP %d\n", code);
  }
  http.end();
}

// ─── SENSOR DATA SEND ────────────────────────────────────────
void sendSensorData() {
  if (WiFi.status() != WL_CONNECTED) return;

  int   moisture = readMoisture();
  float temp     = readTemperature();
  float humidity = readHumidity();
  float ph       = readPH();
  int   tank     = readTankLevel();

  WiFiClient wifiClient;
  HTTPClient http;

  String url = String(SERVER_URL) + "/api/esp8266/data";
  http.begin(wifiClient, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Api-Key", DEVICE_API_KEY);
  http.setTimeout(8000);

  StaticJsonDocument<512> doc;
  doc["deviceId"]        = DEVICE_ID;
  doc["pumpStatus"]      = pumpStatus;
  doc["batteryLevel"]    = readBatteryLevel();
  doc["signalStrength"]  = WiFi.RSSI();
  doc["firmwareVersion"] = FIRMWARE_VER;

  JsonArray sensors = doc.createNestedArray("sensors");

  if (moisture >= 0) {
    JsonObject s1 = sensors.createNestedObject();
    s1["type"]  = "moisture";
    s1["value"] = moisture;
  }
  if (temp > -998) {
    JsonObject s2 = sensors.createNestedObject();
    s2["type"]  = "temperature";
    s2["value"] = temp;
  }
  if (humidity > -998) {
    JsonObject s3 = sensors.createNestedObject();
    s3["type"]  = "humidity";
    s3["value"] = humidity;
  }
  {
    JsonObject s4 = sensors.createNestedObject();
    s4["type"]  = "pH";
    s4["value"] = ph;
  }
  {
    JsonObject s5 = sensors.createNestedObject();
    s5["type"]  = "tankLevel";
    s5["value"] = tank;
  }

  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  if (code == 200) {
    // Parse server response to get pending commands
    String response = http.getString();
    StaticJsonDocument<256> resp;
    DeserializationError err = deserializeJson(resp, response);

    if (!err) {
      // Apply pump command from server
      String serverPump = resp["pump"] | pumpStatus;
      if (serverPump != pumpStatus) {
        pumpStatus = serverPump;
        if (pumpStatus == "ON") {
          digitalWrite(PUMP_RELAY_PIN, LOW);  // Active-low: LOW = ON
          Serial.println("[Pump] Turned ON by server command");
        } else {
          digitalWrite(PUMP_RELAY_PIN, HIGH);
          Serial.println("[Pump] Turned OFF by server command");
        }
      }

      // Apply buzzer command from server
      String serverBuzzer = resp["buzzer"] | buzzerStatus;
      if (serverBuzzer != buzzerStatus) {
        buzzerStatus = serverBuzzer;
        if (buzzerStatus == "ON") {
          digitalWrite(BUZZER_PIN, HIGH);
          Serial.println("[Buzzer] Turned ON by server command");
        } else {
          digitalWrite(BUZZER_PIN, LOW);
          Serial.println("[Buzzer] Turned OFF by server command");
        }
      }
    }
    Serial.println("[Data] Sensor data sent successfully");
  } else {
    Serial.printf("[Data] Send failed, HTTP %d\n", code);
  }
  http.end();
}
