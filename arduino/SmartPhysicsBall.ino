#include <Arduino.h>
#include <WiFiNINA.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <Arduino_LSM6DS3.h>

// =========================
// CONFIGURATION
// =========================
#define DEBUG_MODE false
#define IMPACT_THRESHOLD 12.0f
#define STREAM_RATE_MS 5
#define CALIBRATION_TIME_MS 2000
#define SMOOTHING_ALPHA 0.25f
#define GYRO_SMOOTHING_ALPHA 0.2f
#define MADGWICK_BETA 0.1f
#define VERBOSE_LOG true

// =========================
// WIFI SETTINGS
// =========================
const char *WIFI_SSID = "YOUR_WIFI_SSID";
const char *WIFI_PASS = "YOUR_WIFI_PASSWORD";

// =========================
// WEBSOCKET CLIENT (Railway)
// =========================
const char *WS_HOST = "sph4u0-dashboard.up.railway.app";
const uint16_t WS_PORT = 8080;
const char *WS_PATH = "/";

// =========================
// GLOBALS
// =========================
WebSocketsClient webSocket;
unsigned long lastStream = 0;
unsigned long lastWiFiCheck = 0;
unsigned long lastSampleUs = 0;

const float GRAVITY = 9.80665f;

struct Vec3 {
  float x;
  float y;
  float z;
};

Vec3 accelBias = {0.0f, 0.0f, 0.0f};
Vec3 gyroBias = {0.0f, 0.0f, 0.0f};
Vec3 accelSmooth = {0.0f, 0.0f, 0.0f};
Vec3 gyroSmooth = {0.0f, 0.0f, 0.0f};
Vec3 velocityVec = {0.0f, 0.0f, 0.0f};

float velocity = 0.0f;
bool impactDetected = false;
int stationaryCount = 0;
unsigned long lastLog = 0;
const unsigned long LOG_INTERVAL_MS = 0; // 0 = log every loop

// Madgwick quaternion
float q0 = 1.0f;
float q1 = 0.0f;
float q2 = 0.0f;
float q3 = 0.0f;

// =========================
// UTILS
// =========================
static inline float lpf(float input, float prev, float alpha) {
  return alpha * input + (1.0f - alpha) * prev;
}

static inline float magnitude(const Vec3 &v) {
  return sqrtf(v.x * v.x + v.y * v.y + v.z * v.z);
}

static inline Vec3 normalizeVec(const Vec3 &v) {
  float mag = magnitude(v);
  if (mag < 1e-6f) {
    return {0.0f, 0.0f, 0.0f};
  }
  return {v.x / mag, v.y / mag, v.z / mag};
}

Vec3 applyBias(const Vec3 &raw, const Vec3 &bias) {
  return {raw.x - bias.x, raw.y - bias.y, raw.z - bias.z};
}

Vec3 smoothVec(const Vec3 &input, const Vec3 &prev, float alpha) {
  return {lpf(input.x, prev.x, alpha), lpf(input.y, prev.y, alpha), lpf(input.z, prev.z, alpha)};
}

void logVec(const char *label, const Vec3 &v) {
  if (!VERBOSE_LOG) return;
  Serial.print(label);
  Serial.print(": ");
  Serial.print(v.x, 4);
  Serial.print(", ");
  Serial.print(v.y, 4);
  Serial.print(", ");
  Serial.println(v.z, 4);
}

void logQuat(const char *label, float a, float b, float c, float d) {
  if (!VERBOSE_LOG) return;
  Serial.print(label);
  Serial.print(": ");
  Serial.print(a, 6);
  Serial.print(", ");
  Serial.print(b, 6);
  Serial.print(", ");
  Serial.print(c, 6);
  Serial.print(", ");
  Serial.println(d, 6);
}

Vec3 eulerFromQuat() {
  float sinr = 2.0f * (q0 * q1 + q2 * q3);
  float cosr = 1.0f - 2.0f * (q1 * q1 + q2 * q2);
  float roll = atan2f(sinr, cosr);

  float sinp = 2.0f * (q0 * q2 - q3 * q1);
  if (sinp > 1.0f) sinp = 1.0f;
  if (sinp < -1.0f) sinp = -1.0f;
  float pitch = asinf(sinp);

  float siny = 2.0f * (q0 * q3 + q1 * q2);
  float cosy = 1.0f - 2.0f * (q2 * q2 + q3 * q3);
  float yaw = atan2f(siny, cosy);

  return {roll * RAD_TO_DEG, pitch * RAD_TO_DEG, yaw * RAD_TO_DEG};
}

// =========================
// MADGWICK FILTER (IMU)
// =========================
void madgwickUpdateIMU(float gx, float gy, float gz, float ax, float ay, float az, float dt) {
  float recipNorm;
  float s0, s1, s2, s3;
  float qDot1, qDot2, qDot3, qDot4;

  if (dt <= 0.0f) {
    return;
  }

  // Normalize accelerometer
  float norm = sqrtf(ax * ax + ay * ay + az * az);
  if (norm < 1e-6f) {
    return;
  }
  recipNorm = 1.0f / norm;
  ax *= recipNorm;
  ay *= recipNorm;
  az *= recipNorm;

  float _2q0 = 2.0f * q0;
  float _2q1 = 2.0f * q1;
  float _2q2 = 2.0f * q2;
  float _2q3 = 2.0f * q3;
  float _4q0 = 4.0f * q0;
  float _4q1 = 4.0f * q1;
  float _4q2 = 4.0f * q2;
  float _8q1 = 8.0f * q1;
  float _8q2 = 8.0f * q2;
  float q0q0 = q0 * q0;
  float q1q1 = q1 * q1;
  float q2q2 = q2 * q2;
  float q3q3 = q3 * q3;

  s0 = _4q0 * q2q2 + _2q2 * ax + _4q0 * q1q1 - _2q1 * ay;
  s1 = _4q1 * q3q3 - _2q3 * ax + 4.0f * q0q0 * q1 - _2q0 * ay - _4q1 + _8q1 * q1q1 + _8q1 * q2q2 + _4q1 * az;
  s2 = 4.0f * q0q0 * q2 + _2q0 * ax + _4q2 * q3q3 - _2q3 * ay - _4q2 + _8q2 * q1q1 + _8q2 * q2q2 + _4q2 * az;
  s3 = 4.0f * q1q1 * q3 - _2q1 * ax + 4.0f * q2q2 * q3 - _2q2 * ay;

  norm = sqrtf(s0 * s0 + s1 * s1 + s2 * s2 + s3 * s3);
  if (norm > 1e-6f) {
    recipNorm = 1.0f / norm;
    s0 *= recipNorm;
    s1 *= recipNorm;
    s2 *= recipNorm;
    s3 *= recipNorm;
  }

  qDot1 = 0.5f * (-q1 * gx - q2 * gy - q3 * gz) - MADGWICK_BETA * s0;
  qDot2 = 0.5f * ( q0 * gx + q2 * gz - q3 * gy) - MADGWICK_BETA * s1;
  qDot3 = 0.5f * ( q0 * gy - q1 * gz + q3 * gx) - MADGWICK_BETA * s2;
  qDot4 = 0.5f * ( q0 * gz + q1 * gy - q2 * gx) - MADGWICK_BETA * s3;

  q0 += qDot1 * dt;
  q1 += qDot2 * dt;
  q2 += qDot3 * dt;
  q3 += qDot4 * dt;

  norm = sqrtf(q0 * q0 + q1 * q1 + q2 * q2 + q3 * q3);
  if (norm < 1e-6f) {
    q0 = 1.0f;
    q1 = 0.0f;
    q2 = 0.0f;
    q3 = 0.0f;
    return;
  }
  recipNorm = 1.0f / norm;
  q0 *= recipNorm;
  q1 *= recipNorm;
  q2 *= recipNorm;
  q3 *= recipNorm;
}

Vec3 gravityFromQuat() {
  Vec3 g;
  g.x = 2.0f * (q1 * q3 - q0 * q2);
  g.y = 2.0f * (q0 * q1 + q2 * q3);
  g.z = q0 * q0 - q1 * q1 - q2 * q2 + q3 * q3;
  g.x *= GRAVITY;
  g.y *= GRAVITY;
  g.z *= GRAVITY;
  return g;
}

// =========================
// DEBUG DATA GENERATOR
// =========================
Vec3 fakeAccel = {0.0f, -9.8f, 0.0f};
Vec3 fakeGyro = {0.0f, 0.0f, 0.0f};
float fakeImpact = 0.0f;
float fakePhase = 0.0f;

void generateFakeData() {
  fakePhase += 0.05f;
  fakeAccel.x = 0.6f * sinf(fakePhase * 1.2f);
  fakeAccel.y = -9.8f + 0.5f * cosf(fakePhase * 1.0f);
  fakeAccel.z = 1.1f * sinf(fakePhase * 0.8f);

  fakeGyro.x = 0.2f * sinf(fakePhase * 1.1f);
  fakeGyro.y = 0.15f * cosf(fakePhase * 1.3f);
  fakeGyro.z = 0.25f * sinf(fakePhase * 0.9f);

  if (random(0, 120) == 0) {
    fakeImpact = random(12, 22);
  }
  fakeImpact *= 0.9f;
  fakeAccel.z += fakeImpact;
}

// =========================
// IMU CALIBRATION
// =========================
void calibrateIMU() {
  Vec3 accelSum = {0.0f, 0.0f, 0.0f};
  Vec3 gyroSum = {0.0f, 0.0f, 0.0f};
  unsigned long start = millis();
  int samples = 0;

  while (millis() - start < CALIBRATION_TIME_MS) {
    if (IMU.accelerationAvailable() && IMU.gyroscopeAvailable()) {
      float ax, ay, az;
      float gx, gy, gz;
      IMU.readAcceleration(ax, ay, az);
      IMU.readGyroscope(gx, gy, gz);

      accelSum.x += ax * GRAVITY;
      accelSum.y += ay * GRAVITY;
      accelSum.z += az * GRAVITY;
      gyroSum.x += gx;
      gyroSum.y += gy;
      gyroSum.z += gz;
      samples++;
    }
    delay(5);
  }

  if (samples > 0) {
    Vec3 accelAvg = {accelSum.x / samples, accelSum.y / samples, accelSum.z / samples};
    Vec3 accelDir = normalizeVec(accelAvg);
    Vec3 gravityVec = {accelDir.x * GRAVITY, accelDir.y * GRAVITY, accelDir.z * GRAVITY};
    accelBias = {accelAvg.x - gravityVec.x, accelAvg.y - gravityVec.y, accelAvg.z - gravityVec.z};

    gyroBias.x = gyroSum.x / samples;
    gyroBias.y = gyroSum.y / samples;
    gyroBias.z = gyroSum.z / samples;
  }

  if (VERBOSE_LOG) {
    Serial.print("Calibration samples: ");
    Serial.println(samples);
    logVec("Accel bias", accelBias);
    logVec("Gyro bias", gyroBias);
  }

  Serial.println("IMU calibration complete.");
}

// =========================
// WIFI + WEBSOCKET
// =========================
void connectWiFi() {
  if (VERBOSE_LOG) {
    Serial.print("Connecting to WiFi");
  }
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  while (WiFi.status() != WL_CONNECTED) {
    if (VERBOSE_LOG) {
      Serial.print(".");
    }
    delay(500);
  }

  if (VERBOSE_LOG) {
    Serial.println("\nWiFi connected.");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("RSSI: ");
    Serial.println(WiFi.RSSI());
    Serial.print("Status: ");
    Serial.println(WiFi.status());
  }
}

void websocketEvent(WStype_t type, uint8_t *payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      if (VERBOSE_LOG) {
        Serial.println("WebSocket connected.");
      }
      break;
    case WStype_DISCONNECTED:
      if (VERBOSE_LOG) {
        Serial.println("WebSocket disconnected.");
      }
      break;
    case WStype_ERROR:
      if (VERBOSE_LOG) {
        Serial.print("WebSocket error: ");
        Serial.write(payload, length);
        Serial.println();
      }
      break;
    case WStype_TEXT:
      if (VERBOSE_LOG) {
        Serial.print("WebSocket RX: ");
        Serial.write(payload, length);
        Serial.println();
      }
      break;
    case WStype_BIN:
      if (VERBOSE_LOG) {
        Serial.print("WebSocket RX BIN bytes: ");
        Serial.println(length);
      }
      break;
    case WStype_PING:
      if (VERBOSE_LOG) {
        Serial.println("WebSocket ping.");
      }
      break;
    case WStype_PONG:
      if (VERBOSE_LOG) {
        Serial.println("WebSocket pong.");
      }
      break;
    default:
      if (VERBOSE_LOG) {
        Serial.print("WebSocket event type: ");
        Serial.println(type);
      }
      break;
  }
}

// =========================
// SETUP
// =========================
void setup() {
  Serial.begin(115200);
  while (!Serial) {
    delay(10);
  }

  if (!DEBUG_MODE) {
    if (!IMU.begin()) {
      Serial.println("Failed to initialize IMU!");
      while (true) {
        delay(1000);
      }
    }
    calibrateIMU();
  }

  connectWiFi();
  if (VERBOSE_LOG) {
    Serial.print("Connecting WebSocket to ");
    Serial.print(WS_HOST);
    Serial.print(":");
    Serial.println(WS_PORT);
  }
  webSocket.beginSSL(WS_HOST, WS_PORT, WS_PATH);
  webSocket.onEvent(websocketEvent);
  webSocket.setReconnectInterval(2000);
  randomSeed(analogRead(A0));
}

// =========================
// LOOP
// =========================
void loop() {
  webSocket.loop();

  unsigned long now = millis();
  if (now - lastStream < STREAM_RATE_MS) {
    return;
  }
  lastStream = now;

  if (WiFi.status() != WL_CONNECTED && now - lastWiFiCheck > 2000) {
    lastWiFiCheck = now;
    if (VERBOSE_LOG) {
      Serial.print("WiFi disconnected, status: ");
      Serial.println(WiFi.status());
      Serial.println("Reconnecting...");
    }
    connectWiFi();
    webSocket.disconnect();
    webSocket.beginSSL(WS_HOST, WS_PORT, WS_PATH);
  }

  unsigned long nowUs = micros();
  float dt = (lastSampleUs == 0) ? (STREAM_RATE_MS / 1000.0f) : (nowUs - lastSampleUs) / 1000000.0f;
  lastSampleUs = nowUs;
  if (dt <= 0.0f || dt > 0.1f) {
    dt = STREAM_RATE_MS / 1000.0f;
  }

  Vec3 accel = {0.0f, 0.0f, 0.0f};
  Vec3 gyro = {0.0f, 0.0f, 0.0f};
  Vec3 accelRaw = {0.0f, 0.0f, 0.0f};
  Vec3 gyroRaw = {0.0f, 0.0f, 0.0f};

  if (DEBUG_MODE) {
    generateFakeData();
    accelRaw = fakeAccel;
    gyroRaw = fakeGyro;
    accel = accelRaw;
    gyro = gyroRaw;
  } else {
    float ax, ay, az;
    float gx, gy, gz;

    if (IMU.accelerationAvailable() && IMU.gyroscopeAvailable()) {
      IMU.readAcceleration(ax, ay, az);
      IMU.readGyroscope(gx, gy, gz);

      accelRaw = {ax * GRAVITY, ay * GRAVITY, az * GRAVITY};
      gyroRaw = {gx, gy, gz};
      accel = accelRaw;
      gyro = gyroRaw;
    } else {
      if (VERBOSE_LOG) {
        Serial.println("IMU data not available.");
      }
      return;
    }

    accel = applyBias(accel, accelBias);
    gyro = applyBias(gyro, gyroBias);
  }

  // Convert gyro from deg/s to rad/s
  gyro.x *= DEG_TO_RAD;
  gyro.y *= DEG_TO_RAD;
  gyro.z *= DEG_TO_RAD;

  // Deadband small gyro noise
  if (fabs(gyro.x) < 0.02f) gyro.x = 0.0f;
  if (fabs(gyro.y) < 0.02f) gyro.y = 0.0f;
  if (fabs(gyro.z) < 0.02f) gyro.z = 0.0f;

  madgwickUpdateIMU(gyro.x, gyro.y, gyro.z, accel.x, accel.y, accel.z, dt);
  Vec3 gravity = gravityFromQuat();
  Vec3 linearAccel = {accel.x - gravity.x, accel.y - gravity.y, accel.z - gravity.z};

  accelSmooth = smoothVec(linearAccel, accelSmooth, SMOOTHING_ALPHA);
  gyroSmooth = smoothVec(gyro, gyroSmooth, GYRO_SMOOTHING_ALPHA);

  float accelMag = magnitude(accelSmooth);
  float gyroMag = magnitude(gyroSmooth);

  velocityVec.x += accelSmooth.x * dt;
  velocityVec.y += accelSmooth.y * dt;
  velocityVec.z += accelSmooth.z * dt;

  // Drift control: decay velocity slowly
  velocityVec.x *= 0.995f;
  velocityVec.y *= 0.995f;
  velocityVec.z *= 0.995f;

  if (accelMag < 0.2f && gyroMag < 0.05f) {
    stationaryCount++;
  } else {
    stationaryCount = 0;
  }

  if (stationaryCount > 8) {
    velocityVec.x *= 0.5f;
    velocityVec.y *= 0.5f;
    velocityVec.z *= 0.5f;
    if (fabs(velocityVec.x) < 0.02f) velocityVec.x = 0.0f;
    if (fabs(velocityVec.y) < 0.02f) velocityVec.y = 0.0f;
    if (fabs(velocityVec.z) < 0.02f) velocityVec.z = 0.0f;
  }

  velocity = magnitude(velocityVec);

  // Impact detection with hysteresis
  if (!impactDetected && accelMag >= IMPACT_THRESHOLD) {
    impactDetected = true;
  } else if (impactDetected && accelMag < (IMPACT_THRESHOLD * 0.6f)) {
    impactDetected = false;
  }

  float impactForce = impactDetected ? accelMag : 0.0f;

  StaticJsonDocument<256> doc;
  doc["accel"]["x"] = accelSmooth.x;
  doc["accel"]["y"] = accelSmooth.y;
  doc["accel"]["z"] = accelSmooth.z;
  doc["gyro"]["x"] = gyroSmooth.x;
  doc["gyro"]["y"] = gyroSmooth.y;
  doc["gyro"]["z"] = gyroSmooth.z;
  doc["velocity"] = velocity;
  doc["impact"] = impactForce;
  doc["impactDetected"] = impactDetected;
  doc["timestamp"] = millis();

  char buffer[256];
  size_t len = serializeJson(doc, buffer);

  if (VERBOSE_LOG && (LOG_INTERVAL_MS == 0 || (now - lastLog) >= LOG_INTERVAL_MS)) {
    lastLog = now;
    Serial.print("dt: ");
    Serial.println(dt, 6);
    logVec("Raw accel", accelRaw);
    logVec("Raw gyro", gyroRaw);
    logVec("Gravity", gravity);
    logVec("Linear accel", linearAccel);
    logVec("Accel smooth", accelSmooth);
    logVec("Gyro smooth", gyroSmooth);
    logQuat("Quaternion", q0, q1, q2, q3);
    Vec3 eulerDeg = eulerFromQuat();
    logVec("Euler deg", eulerDeg);
    Serial.print("Velocity vec: ");
    Serial.print(velocityVec.x, 4);
    Serial.print(", ");
    Serial.print(velocityVec.y, 4);
    Serial.print(", ");
    Serial.println(velocityVec.z, 4);
    Serial.print("Velocity mag: ");
    Serial.println(velocity, 4);
    Serial.print("Impact mag: ");
    Serial.println(accelMag, 4);
    Serial.print("Impact detected: ");
    Serial.println(impactDetected ? "true" : "false");
    Serial.print("JSON: ");
    Serial.write(buffer, len);
    Serial.println();
  }

  if (webSocket.isConnected()) {
    webSocket.sendTXT(buffer, len);
    if (VERBOSE_LOG) {
      Serial.print("WebSocket TX bytes: ");
      Serial.println(len);
    }
  } else if (VERBOSE_LOG) {
    Serial.println("WebSocket not connected, skip send.");
  }
}
