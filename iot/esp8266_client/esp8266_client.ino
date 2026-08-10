#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <ArduinoJson.h> // Ensure you install ArduinoJson library via Library Manager
#include <DHT.h>         // Ensure you install DHT sensor library

// WiFi Credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Backend API URL (Update with your local IP or domain)
const char* serverName = "http://YOUR_SERVER_IP:5000/api/esp8266/data";
const char* deviceApiKey = "CHANGE_THIS_TO_YOUR_DEVICE_API_KEY";

// Device Info
const String deviceId = "YOUR_DEVICE_ID"; 

// Pin Definitions
#define SOIL_MOISTURE_PIN A0
#define WATER_LEVEL_PIN D1
#define PH_SENSOR_PIN D2 // Example digital pin, if using ADC multiplexer, adjust accordingly.
#define HUMIDITY_PIN D5  // DHT Sensor pin
#define DHTTYPE DHT11    // DHT 11 or DHT 22
#define WATER_PUMP_PIN D3
#define BUZZER_PIN D4

DHT dht(HUMIDITY_PIN, DHTTYPE);

// Thresholds
const int MOISTURE_THRESHOLD = 30; // 30% moisture threshold for auto irrigation

// Timers
unsigned long lastTime = 0;
unsigned long timerDelay = 10000; // Send data every 10 seconds

void setup() {
  Serial.begin(115200);
  dht.begin();

  // Initialize Pins
  pinMode(WATER_LEVEL_PIN, INPUT);
  pinMode(PH_SENSOR_PIN, INPUT);
  pinMode(WATER_PUMP_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  digitalWrite(WATER_PUMP_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  // Connect to WiFi
  WiFi.begin(ssid, password);
  Serial.println("Connecting to WiFi...");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected to WiFi network with IP Address: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  // Read Sensors
  int rawSoil = analogRead(SOIL_MOISTURE_PIN);
  int moisturePercentage = map(rawSoil, 1023, 0, 0, 100); 
  
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  
  // Example dummy readings for digital sensors without ADC mux
  int waterLevelRaw = digitalRead(WATER_LEVEL_PIN); 
  float phLevel = 6.5; // Placeholder for actual pH analog conversion

  // 1. AUTOMATIC FALLBACK LOGIC
  // Trigger pump automatically if moisture is below threshold
  bool isTankEmpty = (waterLevelRaw == LOW); // Assuming LOW means empty
  
  if (moisturePercentage < MOISTURE_THRESHOLD && !isTankEmpty) {
    digitalWrite(WATER_PUMP_PIN, HIGH); // Turn ON pump
    Serial.println("Auto-Irrigation: ON (Soil dry)");
  } else {
    digitalWrite(WATER_PUMP_PIN, LOW);  // Turn OFF pump
  }

  // 2. ALARM LOGIC (Buzzer)
  if (isTankEmpty) {
    digitalWrite(BUZZER_PIN, HIGH); // Sound alarm
    Serial.println("ALARM: Water Tank Empty!");
  } else {
    digitalWrite(BUZZER_PIN, LOW);
  }

  // 3. SEND DATA TO BACKEND
  if ((millis() - lastTime) > timerDelay) {
    if (WiFi.status() == WL_CONNECTED) {
      WiFiClient client;
      HTTPClient http;
      
      http.begin(client, serverName);
      http.addHeader("Content-Type", "application/json");
      http.addHeader("X-Device-Api-Key", deviceApiKey);
      
      StaticJsonDocument<500> doc;
      doc["deviceId"] = deviceId;
      
      JsonArray sensors = doc.createNestedArray("sensors");
      
      JsonObject s1 = sensors.createNestedObject();
      s1["type"] = "moisture";
      s1["value"] = moisturePercentage;
      
      JsonObject s2 = sensors.createNestedObject();
      s2["type"] = "pH";
      s2["value"] = phLevel;
      
      JsonObject s3 = sensors.createNestedObject();
      s3["type"] = "temperature";
      s3["value"] = isnan(temperature) ? 0 : temperature;
      
      JsonObject s4 = sensors.createNestedObject();
      s4["type"] = "humidity";
      s4["value"] = isnan(humidity) ? 0 : humidity;
      
      JsonObject s5 = sensors.createNestedObject();
      s5["type"] = "tankLevel";
      s5["value"] = isTankEmpty ? 0 : 100;
      
      doc["pumpStatus"] = digitalRead(WATER_PUMP_PIN) == HIGH ? "ON" : "OFF";
      
      String httpRequestData;
      serializeJson(doc, httpRequestData);
      
      int httpResponseCode = http.POST(httpRequestData);
      if (httpResponseCode > 0) {
        String payload = http.getString();
        Serial.print("Response: ");
        Serial.println(payload);

        StaticJsonDocument<250> responseDoc;
        DeserializationError error = deserializeJson(responseDoc, payload);
        if (!error) {
          if (responseDoc.containsKey("pump")) {
            String pumpCmd = responseDoc["pump"];
            if (pumpCmd == "ON") {
              digitalWrite(WATER_PUMP_PIN, HIGH);
              Serial.println("Action: Pump ON");
            } else if (pumpCmd == "OFF") {
              digitalWrite(WATER_PUMP_PIN, LOW);
              Serial.println("Action: Pump OFF");
            }
          }
          if (responseDoc.containsKey("buzzer")) {
            String buzzerCmd = responseDoc["buzzer"];
            if (buzzerCmd == "ON") {
              digitalWrite(BUZZER_PIN, HIGH);
              Serial.println("Action: Buzzer ON");
            } else if (buzzerCmd == "OFF") {
              digitalWrite(BUZZER_PIN, LOW);
              Serial.println("Action: Buzzer OFF");
            }
          }
        } else {
          Serial.print("Failed to parse response JSON: ");
          Serial.println(error.f_str());
        }
      }
      http.end();
    }
    lastTime = millis();
  }
}
