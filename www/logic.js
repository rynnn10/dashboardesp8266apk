// Di bagian paling atas logic.js
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((registration) => {
      // Paksa update jika ada perubahan SW
      registration.update();
    });

    // TAMBAHKAN INI UNTUK MEMASTIKAN AI DIMUAT SAAT AWAL
    setTimeout(() => {
      initFaceApp();
    }, 1000);
  });
}
let lastAutoFanTrigger = !1;
let isCameraOn = !1;
let isDoorLocked = !0;
let currentLat = null;
let currentLon = null;
let lastCapturedRawData = null;
let lastCapturedHex = null;
let isBackgroundAnimationRunning = !0;
let lastIrSentTime = 0;
let lastHandCheck = 0;
let isModelLoaded = false; // <--- INI YANG HILANG SEBELUMNYA
const HAND_CHECK_FPS = 100;
const GAS_URL =
  "https://script.google.com/macros/s/AKfycbx81SDpAJvU7Yjc8NUrasIRxCXnhkNL9LMm1LSIXJ1ZGrWexgAZ-X9L56PXED4WCPc7/exec";
let player;
let isMusicPlaying = !1;
let pausedByVoice = !1;
let watchdogTimer = null;
let YOUTUBE_LINK =
  "https://youtube.com/playlist?list=PL8NGhre-uK_MnZpWNCX2l8kYvqzwy9x6b&si=mPHQRL7P5sDjdNui";
function getYoutubeData(url) {
  let videoId = null;
  let listId = null;
  const listMatch = url.match(/[?&]list=([^#\&\?]+)/);
  if (listMatch) listId = listMatch[1];
  const videoMatch = url.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
  );
  if (videoMatch) videoId = videoMatch[1];
  return { videoId, listId };
}
window.onYouTubeIframeAPIReady = function () {
  const data = getYoutubeData(YOUTUBE_LINK);
  let playerConfig = {
    height: "200",
    width: "200",
    playerVars: {
      playsinline: 1,
      controls: 0,
      loop: 1,
      autoplay: 0,
      origin: window.location.origin,
      enablejsapi: 1,
    },
    events: {
      onReady: onPlayerReady,
      onError: onPlayerError,
      onStateChange: onPlayerStateChange,
    },
  };
  if (data.listId) {
    playerConfig.playerVars.listType = "playlist";
    playerConfig.playerVars.list = data.listId;
  } else if (data.videoId) {
    playerConfig.videoId = data.videoId;
  } else {
    playerConfig.videoId = "jfKfPfyJRdk";
  }
  player = new YT.Player("youtube-player", playerConfig);
};
function onPlayerReady(event) {
  console.log("✅ Musik Player Siap (Background Mode)");
  event.target.setVolume(100);
}
function onPlayerError(event) {
  console.error("YouTube Error:", event.data);
  if (event.data === 150 || event.data === 101) {
    console.warn("Lagu dilewati karena hak cipta.");
    if (player && player.nextVideo) player.nextVideo();
  }
}
function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING) {
    isMusicPlaying = !0;
    setupMediaSession();
    startWatchdog();
  } else if (event.data === YT.PlayerState.PAUSED) {
    if (isMusicPlaying && !pausedByVoice) {
      console.log("⚠️ Browser mencoba mematikan musik -> Memaksa Play...");
      setTimeout(() => {
        if (player && player.playVideo) player.playVideo();
      }, 100);
    } else {
      stopWatchdog();
    }
  } else if (event.data === YT.PlayerState.ENDED) {
    if (player && player.nextVideo) player.nextVideo();
  }
}
function setupMediaSession() {
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: "IoT Background Music",
      artist: "Smart Dashboard",
      album: "Lofi Mode",
      artwork: [
        { src: "./logoapk.jpg", sizes: "96x96", type: "image/png" },
        { src: "./logoapk.jpg", sizes: "192x192", type: "image/png" },
      ],
    });
    navigator.mediaSession.setActionHandler("play", function () {
      controlMusic("PLAY");
    });
    navigator.mediaSession.setActionHandler("pause", function () {
      controlMusic("STOP");
    });
    navigator.mediaSession.setActionHandler("stop", function () {
      controlMusic("STOP");
    });
    navigator.mediaSession.setActionHandler("nexttrack", function () {
      if (player) player.nextVideo();
    });
  }
}
function controlMusic(action) {
  if (!player || typeof player.playVideo !== "function")
    return bicara("Player sedang memuat.", !1);
  if (action === "PLAY") {
    isMusicPlaying = !0;
    pausedByVoice = !1;
    player.playVideo();
  } else if (action === "STOP") {
    isMusicPlaying = !1;
    player.pauseVideo();
  }
}
function startWatchdog() {
  if (watchdogTimer) clearInterval(watchdogTimer);
  watchdogTimer = setInterval(() => {
    if (isMusicPlaying && !pausedByVoice) {
      if (
        player &&
        player.getPlayerState &&
        player.getPlayerState() !== 1 &&
        player.getPlayerState() !== 3
      ) {
        console.log("🐶 Watchdog: Musik mati sendiri, menghidupkan kembali...");
        player.playVideo();
      }
    }
  }, 4000);
}
function stopWatchdog() {
  if (watchdogTimer) clearInterval(watchdogTimer);
}
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "hidden") {
    if (isMusicPlaying && !pausedByVoice) {
      setTimeout(() => {
        if (player && player.playVideo) player.playVideo();
      }, 200);
    }
  }
});
const video = document.getElementById("video");
const canvas = document.getElementById("snapshot-canvas");
const captureBtn = document.getElementById("capture-btn");
const toggleCamBtn = document.getElementById("toggle-cam-btn");
const lightBtn = document.getElementById("light-btn");
const helpBtn = document.getElementById("help-btn");
const nameInput = document.getElementById("name-input");
const saveBtn = document.getElementById("save-btn");
const globalModal = document.getElementById("global-modal");
const registerModal = document.getElementById("register-modal");
const modalTitle = document.getElementById("modal-title");
const modalMsg = document.getElementById("modal-msg");
const modalIcon = document.getElementById("modal-icon");
const modalIconBg = document.getElementById("modal-icon-bg");
const modalButtons = document.getElementById("modal-buttons");
const DEFAULT_LAT = -7.7956;
const DEFAULT_LON = 110.3695;
function switchPage(pageId, element) {
  if (
    document.getElementById("page-hand").classList.contains("active-page") &&
    pageId !== "page-hand"
  ) {
    if (typeof stopHandCamera === "function") stopHandCamera();
  }
  if (
    document.getElementById("page-absensi").classList.contains("active-page") &&
    pageId !== "page-absensi"
  ) {
    if (typeof stopCamera === "function") stopCamera();
  }
  document
    .querySelectorAll(".page-section")
    .forEach((el) => el.classList.remove("active-page"));
  document.getElementById(pageId).classList.add("active-page");
  const backBtn = document.getElementById("btn-back-home");
  const headerTitle = document.getElementById("mobile-header-title");
  const titles = {
    "page-home": "IoT Dashboard",
    "page-absensi": "Scan Wajah",
    "page-sensor": "Monitor Suhu",
    "page-control": "Smart Control",
    "page-remote": "Smart Remote",
    "page-cuaca": "Cuaca Pro",
    "page-hand": "Hand Control",
  };
  if (headerTitle) {
    headerTitle.innerText = titles[pageId] || "IoT Dashboard";
  }
  if (backBtn) {
    if (pageId === "page-home") {
      backBtn.classList.add("hidden");
    } else {
      backBtn.classList.remove("hidden");
    }
  }
  if (element && element.classList.contains("nav-item")) {
    document
      .querySelectorAll(".nav-item")
      .forEach((el) => el.classList.remove("active"));
    element.classList.add("active");
  }
  if (pageId === "page-cuaca" && typeof map !== "undefined") {
    setTimeout(() => map.invalidateSize(), 300);
  }
  if (pageId === "page-absensi" || pageId === "page-hand") {
    isBackgroundAnimationRunning = !1;
    document.getElementById("bg-canvas").style.display = "none";
  } else {
    isBackgroundAnimationRunning = !0;
    document.getElementById("bg-canvas").style.display = "block";
  }
}
const mqtt_topic_ir_send = "projek/belajar/ir_remote_riyan10/send";
const mqtt_topic_ir_recv = "projek/belajar/ir_remote_riyan10/recv";
const mqtt_topic_sensor = "projek/belajar/sensoe_suhu_riyan10_bro";
const mqtt_topic_fan_ctrl = "projek/belajar/sensoe_suhu_riyan10_bro/control";
const mqtt_topic_schedule = "projek/belajar/jadwal_kipas_riyan10_storage";
const mqtt_topic_security_ctrl = "projek/belajar/perintah_kipas";
const mqtt_topic_status_esp1 = "projek/belajar/status/esp1";
const mqtt_topic_status_esp2 = "projek/belajar/status/esp2";
const mqtt_topic_status_esp3 = "projek/belajar/status/esp3";
const mqtt_topic_status_esp4 = "projek/belajar/status/esp4";
const mqtt_broker = "broker.emqx.io";
const mqtt_port = 8084;
const mqtt_useSSL = !0;
const mqtt_clientID = "web-" + Math.random().toString(36).substring(7);
const mqttClient = new Paho.MQTT.Client(
  mqtt_broker,
  mqtt_port,
  "/mqtt",
  mqtt_clientID,
);
mqttClient.onConnectionLost = (res) => {
  console.warn("⚠️ MQTT Terputus:", res.errorMessage);
  updateStatus(!1, "Terputus");
};
mqttClient.onMessageArrived = (msg) => {
  const topic = msg.destinationName;
  const payload = msg.payloadString;
  if (topic === mqtt_topic_security_ctrl) {
    if (payload === "ALARM_API") {
      const toggleApi = document.getElementById("toggle-api");
      if (toggleApi && !toggleApi.checked) {
        console.warn("⚠️ Alarm Api diabaikan karena Sistem Web OFF.");
        return;
      }
      showInfoModal(
        "BAHAYA API!",
        "Sensor mendeteksi api! Sistem Alarm menyala.",
        "alarm",
      );
      sendSystemNotification(
        "🔥 KEBAKARAN TERDETEKSI!",
        "Segera periksa lokasi! Buzzer berbunyi 10x.",
      );
      console.log("🚨 [CRITICAL] ALARM API DITERIMA!");
      return;
    }
    if (payload === "ALARM_LASER") {
      const toggleLaser = document.getElementById("toggle-laser");
      if (toggleLaser && !toggleLaser.checked) return;
      showInfoModal(
        "PENYUSUP!",
        "Sensor Laser Terputus! Alarm berbunyi terus-menerus.",
        "alarm",
      );
      sendSystemNotification(
        "🚨 ALARM LASER",
        "Sinar laser terpotong! Cek keamanan pintu.",
      );
      return;
    }
    if (payload === "SAFE_LASER") {
      showInfoModal("Aman", "Laser kembali menyatu. Area aman.", "success");
      console.log("✅ Laser Kembali Normal");
      return;
    }
    if (payload === "ALARM_IR") {
      const toggleIr = document.getElementById("toggle-ir");
      if (toggleIr && !toggleIr.checked) return;
      showInfoModal(
        "GERAKAN!",
        "Sensor IR mendeteksi pergerakan objek.",
        "alarm",
      );
      sendSystemNotification(
        "⚠️ ALARM IR",
        "Ada pergerakan terdeteksi sensor.",
      );
      return;
    }
    if (payload === "ALARM_HC") {
      const toggleHc = document.getElementById("toggle-hc");
      if (toggleHc && !toggleHc.checked) return;
      showInfoModal(
        "OBJEK DEKAT!",
        "Sensor Jarak mendeteksi objek mencurigakan.",
        "alarm",
      );
      sendSystemNotification(
        "📏 ALARM JARAK",
        "Ada objek terlalu dekat dengan sensor HC.",
      );
      return;
    }
    if (payload === "SAFE_API") {
      showInfoModal(
        "Aman",
        "Api sudah padam. Sistem kembali normal.",
        "success",
      );
      return;
    }
    if (payload === "RESET_FACES_DONE") {
      console.log("🧹 Perintah Reset Wajah diterima dari Telegram/ESP");
      labeledDescriptors = [];
      renderList();
      showInfoModal(
        "Reset Berhasil",
        "Database wajah telah dikosongkan via Telegram.",
        "info",
      );
      setAppStatus("Database Kosong", "success");
      return;
    }
  }
  if (topic.includes("/control/api")) {
    const toggleApi = document.getElementById("toggle-api");
    const isActive = payload === "ON" || payload === "/apiON";
    if (toggleApi) toggleApi.checked = isActive;
    console.log(`🔄 [SYNC] Tombol Api -> ${isActive ? "ON" : "OFF"}`);
    return;
  }
  if (topic.includes("/control/laser")) {
    const el = document.getElementById("toggle-laser");
    if (el) el.checked = payload === "ON";
    return;
  }
  if (topic.includes("/control/ir")) {
    const el = document.getElementById("toggle-ir");
    if (el) el.checked = payload === "ON";
    return;
  }
  if (topic.includes("/control/hc")) {
    const el = document.getElementById("toggle-hc");
    if (el) el.checked = payload === "ON";
    return;
  }
  if (msg.destinationName === mqtt_topic_sensor) {
    try {
      const data = JSON.parse(msg.payloadString);
      if (data.suhu2 !== undefined && data.suhu2 !== null) {
        document.getElementById("temp2").innerText = parseFloat(
          data.suhu2,
        ).toFixed(1);
      }
      if (data.hum2 !== undefined && data.hum2 !== null) {
        document.getElementById("hum2").innerText = parseFloat(
          data.hum2,
        ).toFixed(0);
      }
    } catch (e) {
      console.error("JSON Error", e);
    }
  } else if (msg.destinationName === mqtt_topic_fan_ctrl) {
    let speed = payload === "OFF" || payload === "0" ? 0 : parseInt(payload);
    if (!isNaN(speed)) {
      updateFanUI(speed);
      currentFanSpeed = speed;
    }
  } else if (msg.destinationName === mqtt_topic_schedule) {
    try {
      fanSchedules = JSON.parse(msg.payloadString);
      renderSchedules();
    } catch (e) {}
  } else if (topic === mqtt_topic_ir_recv) {
    if (Date.now() - lastIrSentTime < 3000) {
      console.log("🛡️ Mengabaikan sinyal pantulan (Anti-Loopback aktif).");
      return;
    }
    try {
      const data = JSON.parse(payload);
      const rawData = data.raw;
      const hexCode = data.hex;
      lastCapturedRawData = rawData;
      lastCapturedHex = hexCode;
      console.log(
        `📡 Sinyal Masuk -> HEX: ${hexCode} | RAW Length: ${rawData.length}`,
      );
      const displayEl = document.getElementById("scanned-code-display");
      const infoEl = document.getElementById("raw-size-info");
      if (displayEl) {
        displayEl.innerHTML = `
            <div class="flex flex-col items-center gap-1 animate-pulse">
              <i class="fa-solid fa-satellite-dish text-emerald-400 text-2xl mb-1"></i>
              <span class="text-white text-2xl font-mono tracking-widest">${hexCode}</span>
              <span class="text-[10px] text-slate-400 font-normal">Sinyal Baru Diterima</span>
            </div>`;
        if (infoEl)
          infoEl.innerText = `Type: RAW & HEX | Size: ${rawData.length} chars`;
        displayEl.parentElement.classList.remove("border-emerald-500/30");
        displayEl.parentElement.classList.add(
          "ring-2",
          "ring-emerald-500",
          "bg-emerald-900/20",
        );
        setTimeout(() => {
          displayEl.parentElement.classList.remove(
            "ring-2",
            "ring-emerald-500",
            "bg-emerald-900/20",
          );
          displayEl.parentElement.classList.add("border-emerald-500/30");
        }, 1000);
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      }
    } catch (e) {
      console.error("Gagal parse JSON IR:", e);
    }
  }
  if (topic.includes("projek/belajar/status/")) {
    try {
      const statusData = JSON.parse(payload);
      let dotId, textId;
      if (topic.endsWith("esp1")) {
        dotId = "status-dot-esp1";
        textId = "ssid-esp1";
      } else if (topic.endsWith("esp2")) {
        dotId = "status-dot-esp2";
        textId = "ssid-esp2";
      } else if (topic.endsWith("esp3")) {
        dotId = "status-dot-esp3";
        textId = "ssid-esp3";
      } else if (topic.endsWith("esp4")) {
        dotId = "status-dot-esp4";
        textId = "ssid-esp4";
      }
      if (dotId && textId) {
        const dot = document.getElementById(dotId);
        const txt = document.getElementById(textId);
        dot.style.backgroundColor = "#22c55e";
        dot.style.boxShadow = "0 0 5px #22c55e";
        txt.innerText = `Online: ${statusData.ssid}`;
        txt.classList.add("text-emerald-400");
        txt.classList.remove("text-slate-500");
      }
    } catch (e) {
      console.error("Status Error", e);
    }
  }
};
function connectMQTT() {
  console.log("🔄 Menghubungkan ke MQTT...");
  mqttClient.connect({
    useSSL: mqtt_useSSL,
    onSuccess: () => {
      console.log("✅ MQTT Terhubung!");
      updateStatus(!0, "Terhubung");
      mqttClient.subscribe(mqtt_topic_ir_recv);
      mqttClient.subscribe(mqtt_topic_sensor);
      mqttClient.subscribe(mqtt_topic_schedule);
      mqttClient.subscribe(mqtt_topic_fan_ctrl);
      mqttClient.subscribe("projek/belajar/sensoe_suhu_riyan10_bro/control/#");
      mqttClient.subscribe(mqtt_topic_security_ctrl);
      mqttClient.subscribe("projek/belajar/status/#");
      console.log("📡 Subscribed to All Control Topics");
      if (fanSchedules.length > 0) {
        console.log("♻️ Restore Jadwal dari HP ke Alat...");
        uploadScheduleToCloud();
      }
    },
    onFailure: (m) => {
      console.error("❌ Gagal Koneksi MQTT:", m.errorMessage);
      updateStatus(!1, "Gagal Koneksi");
    },
  });
}
let homeClockInterval = null;
function updateStatus(isCon, text) {
  const elText = document.getElementById("status-text");
  const dot = document.getElementById("status-dot");
  const headerDot = document.getElementById("header-status-dot");
  const homeTopDot = document.getElementById("home-top-dot");
  const homeTopText = document.getElementById("home-top-text");
  const homeHeaderBox = document.getElementById("home-header-status");
  if (isCon) {
    const greenStyle = { bg: "#22c55e", shadow: "0 0 10px #22c55e" };
    if (dot) {
      dot.style.backgroundColor = greenStyle.bg;
      dot.style.boxShadow = greenStyle.shadow;
    }
    if (elText) elText.innerText = "Terhubung";
    if (headerDot) {
      headerDot.style.backgroundColor = greenStyle.bg;
      headerDot.style.boxShadow = greenStyle.shadow;
    }
    if (homeTopDot) {
      homeTopDot.style.backgroundColor = greenStyle.bg;
      homeTopDot.style.boxShadow = greenStyle.shadow;
    }
    if (homeTopText) {
      homeTopText.innerText = "Sistem Terhubung!";
      homeTopText.classList.add("text-emerald-400");
      if (homeClockInterval) clearInterval(homeClockInterval);
      setTimeout(() => {
        updateRealTimeClock(homeTopText);
        homeClockInterval = setInterval(() => {
          updateRealTimeClock(homeTopText);
        }, 1000);
      }, 3000);
    }
  } else {
    const redStyle = { bg: "#ef4444", shadow: "0 0 10px #ef4444" };
    if (homeClockInterval) clearInterval(homeClockInterval);
    if (dot) {
      dot.style.backgroundColor = redStyle.bg;
      dot.style.boxShadow = redStyle.shadow;
    }
    if (elText) elText.innerText = "Terputus";
    if (headerDot) {
      headerDot.style.backgroundColor = redStyle.bg;
      headerDot.style.boxShadow = redStyle.shadow;
    }
    if (homeTopDot) {
      homeTopDot.style.backgroundColor = redStyle.bg;
      homeTopDot.style.boxShadow = redStyle.shadow;
    }
    if (homeTopText) {
      homeTopText.innerText = "Koneksi Terputus!";
      homeTopText.classList.remove("text-emerald-400");
      homeTopText.classList.add("text-red-400");
    }
  }
}
function updateRealTimeClock(element) {
  const now = new Date();
  const dateOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  };
  const dateStr = now.toLocaleDateString("id-ID", dateOptions);
  const timeStr = now
    .toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    .replace(/\./g, ":");
  element.innerText = `${dateStr} • ${timeStr} WIB`;
  element.classList.remove("text-red-400");
  element.classList.add("text-emerald-300");
}
let map, marker, searchTimeout;
let isMapFullscreen = !1;
const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth();
function initMap() {
  map = L.map("map", { zoomControl: !1 }).setView(
    [DEFAULT_LAT, DEFAULT_LON],
    13,
  );
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; CARTO",
    maxZoom: 19,
  }).addTo(map);
  marker = L.marker([DEFAULT_LAT, DEFAULT_LON]).addTo(map);
  L.control.zoom({ position: "bottomright" }).addTo(map);
  map.on("click", (e) => {
    fetchWeather(e.latlng.lat, e.latlng.lng, !0);
  });
}
function toggleMapSize() {
  const container = document.getElementById("mapContainer");
  const icon = document.getElementById("resizeIcon");
  isMapFullscreen = !isMapFullscreen;
  if (isMapFullscreen) {
    container.classList.add("fullscreen");
    icon.className = "fa-solid fa-compress";
  } else {
    container.classList.remove("fullscreen");
    icon.className = "fa-solid fa-expand";
  }
  setTimeout(() => {
    map.invalidateSize();
  }, 300);
}
async function getPreciseAddress(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        "Accept-Language": "id",
        "User-Agent": "IoT-Dashboard-Project/1.0",
      },
    });
    if (!res.ok) throw new Error("Nominatim Failed");
    const data = await res.json();
    const a = data.address;
    const parts = [];
    if (a.road) parts.push(a.road);
    if (a.neighbourhood) parts.push(a.neighbourhood);
    if (a.quarter) parts.push(a.quarter);
    if (a.village || a.suburb) parts.push(a.village || a.suburb);
    if (a.city_district || a.district)
      parts.push(a.city_district || a.district);
    if (a.city || a.town || a.county) parts.push(a.city || a.town || a.county);
    if (a.state) parts.push(a.state);
    if (a.country) parts.push(a.country);
    const mainName = a.village || a.road || data.name || "Lokasi Terpilih";
    const subName = parts.join(", ");
    return { main: mainName, sub: subName };
  } catch (e) {
    const url2 = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=id`;
    try {
      const res2 = await fetch(url2);
      const data2 = await res2.json();
      const city = data2.city || data2.locality || "";
      const district = data2.principalSubdivision || "";
      const country = data2.countryName || "";
      return {
        main: city ? city : district,
        sub: `${city}, ${district}, ${country}`,
      };
    } catch (ex) {
      return {
        main: "Koordinat Peta",
        sub: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
      };
    }
  }
}
async function fetchWeather(lat, lon, autoAddress = !1, manualName = null) {
  currentLat = lat;
  currentLon = lon;
  document.getElementById("mainDesc").innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i>';
  marker.setLatLng([lat, lon]);
  if (!isMapFullscreen) map.setView([lat, lon], 14);
  document.getElementById("locName").innerText = "Melacak Detail...";
  document.getElementById("locSub").innerText = "Mengambil data satelit...";
  try {
    const addr = await getPreciseAddress(lat, lon);
    document.getElementById("locName").innerText = addr.main;
    document.getElementById("locSub").innerText = addr.sub;
  } catch (e) {
    document.getElementById("locName").innerText =
      manualName || "Lokasi Terpilih";
    document.getElementById("locSub").innerText = `${lat.toFixed(
      4,
    )}, ${lon.toFixed(4)}`;
  }
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,visibility&daily=weather_code,temperature_2m_max,temperature_2m_min&hourly=temperature_2m,weather_code&timezone=auto&forecast_days=16`;
    const res = await fetch(url);
    const data = await res.json();
    renderCurrent(data.current);
    renderCalendar(data.daily);
    renderHourly(data.hourly);
  } catch (e) {
    showInfoModal("Gagal", "Tidak dapat mengambil data cuaca.", "error");
  }
}
function renderCurrent(curr) {
  const info = getWeatherInfo(curr.weather_code);
  const tempVal = Math.round(curr.temperature_2m);
  document.getElementById("mainTemp").innerText = tempVal + "°";
  document.getElementById("mainDesc").innerText = info.desc;
  document.getElementById("mainIcon").className =
    `fa-solid ${info.icon} text-5xl mb-4 ${info.color}`;
  document.getElementById("wind").innerText = curr.wind_speed_10m + " km/h";
  document.getElementById("humid-weather").innerText =
    curr.relative_humidity_2m + "%";
  document.getElementById("vis").innerText =
    (curr.visibility / 1000).toFixed(1) + " km";
  const options = {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  };
  document.getElementById("currentDateStr").innerText =
    new Date().toLocaleDateString("id-ID", options);
  if (tempVal <= 20) {
    if (!lastAutoFanTrigger) {
      console.log(`❄️ Dingin Sekali (${tempVal}°C)! Matikan Kipas.`);
      triggerESP("kipas-off");
      lastAutoFanTrigger = !0;
    }
  } else {
    lastAutoFanTrigger = !1;
  }
}
function renderHourly(hourly) {
  const container = document.getElementById("hourly-container");
  container.innerHTML = "";
  const now = new Date();
  let startIndex = -1;
  for (let i = 0; i < hourly.time.length; i++) {
    if (new Date(hourly.time[i]) >= now) {
      startIndex = i;
      break;
    }
  }
  if (startIndex === -1) startIndex = 0;
  for (let i = 0; i < 12; i++) {
    const idx = startIndex + i;
    if (idx >= hourly.time.length) break;
    const timeObj = new Date(hourly.time[idx]);
    const hourStr = timeObj.getHours().toString().padStart(2, "0") + ":00";
    const temp = Math.round(hourly.temperature_2m[idx]);
    const code = hourly.weather_code[idx];
    const info = getWeatherInfo(code);
    const div = document.createElement("div");
    div.className = "hourly-item";
    div.innerHTML = `
            <div class="text-[10px] text-gray-400 mb-1">${hourStr}</div>
            <i class="fa-solid ${info.icon} ${info.color} text-xl mb-1"></i>
            <div class="text-[9px] text-blue-300 mb-1 leading-tight w-full whitespace-nowrap overflow-hidden text-ellipsis">${info.desc}</div>
            <div class="text-sm font-bold text-white">${temp}°</div>
        `;
    container.appendChild(div);
  }
}
function getWeatherInfo(code) {
  const map = {
    0: { desc: "Cerah", icon: "fa-sun", color: "text-yellow-400" },
    1: {
      desc: "Cerah Berawan",
      icon: "fa-cloud-sun",
      color: "text-yellow-300",
    },
    2: { desc: "Berawan", icon: "fa-cloud", color: "text-gray-400" },
    3: { desc: "Mendung", icon: "fa-cloud", color: "text-gray-500" },
    45: { desc: "Kabut", icon: "fa-smog", color: "text-gray-400" },
    51: { desc: "Gerimis", icon: "fa-cloud-rain", color: "text-blue-300" },
    61: {
      desc: "Hujan",
      icon: "fa-cloud-showers-heavy",
      color: "text-blue-400",
    },
    80: {
      desc: "Hujan Lokal",
      icon: "fa-cloud-sun-rain",
      color: "text-indigo-400",
    },
    95: { desc: "Petir", icon: "fa-bolt", color: "text-yellow-500" },
  };
  return map[code] || { desc: "-", icon: "fa-minus", color: "text-gray-600" };
}
function renderCalendar(daily) {
  const grid = document.getElementById("calendarGrid");
  grid.innerHTML = "";
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
  const weatherMap = {};
  daily.time.forEach((t, i) => {
    weatherMap[t] = {
      code: daily.weather_code[i],
      max: Math.round(daily.temperature_2m_max[i]),
      min: Math.round(daily.temperature_2m_min[i]),
    };
  });
  for (let i = 0; i < firstDayIndex; i++)
    grid.innerHTML += `<div class="bg-slate-800/50 min-h-[80px]"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${currentYear}-${(currentMonth + 1)
      .toString()
      .padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
    const w = weatherMap[dateKey];
    const isToday = dateKey === new Date().toISOString().split("T")[0];
    let html = `<div class="p-1 min-h-[80px] flex flex-col justify-between transition hover:bg-white/5 ${
      isToday ? "bg-blue-600/10" : "bg-slate-800/80"
    }">
            <span class="text-[10px] font-bold ${
      isToday ? "text-blue-400" : "text-gray-500"
    }">${d}</span>`;
    if (w) {
      const info = getWeatherInfo(w.code);
      html += `<div class="text-center"><i class="fa-solid ${info.icon} ${info.color} text-lg"></i></div>
                     <div class="text-[9px] text-center text-white mt-1">${w.max}° <span class="text-gray-500">${w.min}°</span></div>`;
    }
    html += `</div>`;
    grid.innerHTML += html;
  }
}
function getMyLocation() {
  if (!navigator.geolocation) {
    showInfoModal("Info GPS", "GPS tidak didukung perangkat ini.", "error");
    fetchWeather(DEFAULT_LAT, DEFAULT_LON, !0);
    return;
  }
  document.getElementById("locName").innerText = "Mendeteksi GPS...";
  navigator.geolocation.getCurrentPosition(
    (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude, !0),
    (err) => {
      console.log("GPS Gagal, Default Yogyakarta");
      fetchWeather(DEFAULT_LAT, DEFAULT_LON, !0);
    },
    { enableHighAccuracy: !0, timeout: 5000 },
  );
}
const searchInp = document.getElementById("searchInput");
const searchRes = document.getElementById("searchResults");
searchInp.addEventListener("input", (e) => {
  clearTimeout(searchTimeout);
  const val = e.target.value;
  if (val.length < 3) {
    searchRes.classList.add("hidden");
    return;
  }
  searchTimeout = setTimeout(async () => {
    searchRes.classList.remove("hidden");
    searchRes.innerHTML = '<div class="p-3 text-xs text-gray-400">...</div>';
    try {
      const r = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${val}&count=5&language=id&format=json`,
      );
      const d = await r.json();
      searchRes.innerHTML = "";
      if (!d.results) {
        searchRes.innerHTML =
          '<div class="p-3 text-xs text-red-400">Nihil</div>';
        return;
      }
      d.results.forEach((loc) => {
        const div = document.createElement("div");
        div.className =
          "px-4 py-2 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50 flex flex-col";
        div.innerHTML = `<span class="text-sm font-bold text-white">${
          loc.name
        }</span><span class="text-xs text-gray-400">${loc.admin1 || ""}, ${
          loc.country || ""
        }</span>`;
        div.onclick = () => {
          fetchWeather(loc.latitude, loc.longitude, !1, loc.name);
          searchRes.classList.add("hidden");
        };
        searchRes.appendChild(div);
      });
    } catch (e) {}
  }, 500);
});
document.addEventListener("click", (e) => {
  if (!searchInp.contains(e.target) && !searchRes.contains(e.target))
    searchRes.classList.add("hidden");
});
const token_p1 = "ghp_";
const token_p2 = "Q2vuaEXDGVjDLA38mQlrg5MagJw1Gd0a81TI";
const GH_TOKEN = token_p1 + token_p2;
const GH_USERNAME = "rynnn10";
const GH_REPO = "Pengenalan_wajah";
const GH_DB_PATH = "database/face_db.json";
const GH_EXCEL_PATH = "foto/absensi.xlsx";
const ESP_IP = "http://192.168.1.2";
const TELEGRAM_BOT_TOKEN = "8034966869:AAFtWJTN0Y1tZaBPR71YBFIwW2w7Ifbsybs";
const TELEGRAM_CHAT_ID = "6439820196";
const MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models";
const SSD_OPTIONS = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
const MATCH_THRESHOLD = 0.5;
let labeledDescriptors = [],
  metadata = [],
  currentDescriptor = null,
  isUnlocking = !1;

// Cari function initFaceApp() dan ganti seluruhnya dengan ini:

async function initFaceApp() {
  try {
    setAppStatus("Mengunduh Model AI...", "loading");

    // Cek koneksi (Opsional)
    if (!navigator.onLine) {
      console.warn("Offline: Menggunakan cache jika ada");
    }

    // 1. Load Model AI
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);

    // SET VARIABLE MENJADI TRUE
    isModelLoaded = true;
    console.log("✅ Model AI Berhasil Dimuat");

    // 2. Load Data Wajah (Dipisah agar jika gagal, AI tetap jalan)
    setAppStatus("Sinkronisasi GitHub...", "loading");

    try {
      await loadFacesFromGitHub();
      // Jika sukses load github, status akan diupdate di dalam fungsi itu
    } catch (dbError) {
      console.warn("GitHub Gagal, mode offline aktif:", dbError);
      setAppStatus("Siap (Mode Offline)", "warning");
    }
  } catch (e) {
    console.error("Critical AI Error:", e);
    setAppStatus("Gagal Memuat AI", "error");
    // Jika gagal total, set true saja agar kamera tetap bisa dibuka (walau tidak deteksi)
    isModelLoaded = true;
    showInfoModal(
      "Koneksi Buruk",
      "Gagal mengunduh model AI. Cek internet Anda.",
      "error",
    );
  }
}

// Modifikasi sedikit pada loadFacesFromGitHub agar tidak menimpa status error
async function loadFacesFromGitHub(isBackground = !1) {
  try {
    if (!isBackground) setAppStatus("Sinkronisasi Data...", "loading");

    // Tambahkan timestamp agar tidak cache
    const uniqueUrl = `https://api.github.com/repos/${GH_USERNAME}/${GH_REPO}/contents/${GH_DB_PATH}?t=${Date.now()}`;

    const res = await fetch(uniqueUrl, {
      method: "GET",
      headers: {
        Authorization: `token ${GH_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
      },
      // Hapus mode: 'cors' jika menyebabkan masalah di WebView tertentu,
      // tapi biasanya diperlukan untuk fetch ke domain lain.
    });

    if (res.ok) {
      const data = await res.json();
      const cleanContent = data.content.replace(/\s/g, "");
      const decodedContent = atob(cleanContent); // Base64 decode

      let jsonDB;
      try {
        jsonDB = JSON.parse(decodedContent);
      } catch (err) {
        console.error("JSON Parse Error:", err);
        jsonDB = [];
      }

      if (!Array.isArray(jsonDB)) jsonDB = [];

      // Mapping data
      labeledDescriptors = jsonDB.map(
        (i) =>
          new faceapi.LabeledFaceDescriptors(
            i.label,
            i.descriptors.map((d) => new Float32Array(Object.values(d))),
          ),
      );

      renderList();
      if (!isBackground) setAppStatus("AI Siap Digunakan", "success");
    } else if (res.status === 404) {
      console.log("Database wajah baru/kosong.");
      labeledDescriptors = [];
      renderList();
      if (!isBackground) setAppStatus("AI Siap (DB Kosong)", "success");
    } else {
      throw new Error(`GitHub API: ${res.status}`);
    }
  } catch (e) {
    console.error("Sync Error:", e);
    if (!isBackground) {
      // Jangan set error fatal, cukup warning agar AI tetap bisa dipakai scan (register baru)
      setAppStatus("Gagal Sync Data", "error");
      throw e; // Lempar error agar ditangkap initFaceApp
    }
  }
}
function setAppStatus(msg, type = "normal") {
  const el = document.getElementById("app-status");
  if (!el) return;
  el.innerHTML = msg;
  el.className =
    type === "success"
      ? "bg-emerald-900/30 border border-emerald-500/30 p-3 rounded-lg text-center text-sm text-emerald-400 font-bold"
      : type === "error"
        ? "bg-red-900/30 border border-red-500/30 p-3 rounded-lg text-center text-sm text-red-400 font-bold"
        : "bg-slate-800 border border-slate-700 p-3 rounded-lg text-center text-sm text-slate-300";
}
async function startCamera() {
  if (!isModelLoaded) {
    return showInfoModal(
      "AI Sedang Memuat",
      "Sabar sebentar, sistem sedang mengunduh model kecerdasan buatan.<br><b>Cek status di kotak biru atas.</b>",
      "loading", // Kita pakai icon loading (info)
    );
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
    });
    video.srcObject = stream;
    video.onloadedmetadata = () => {
      video.play();
      isCameraOn = !0;
      video.style.display = "block";
      document.getElementById("initial-placeholder").classList.add("hidden");
      captureBtn.disabled = !1;
      captureBtn.innerHTML = '<i class="fa-solid fa-camera"></i> SCAN WAJAH';
      toggleCamBtn.innerHTML = '<i class="fa-solid fa-video"></i>';
    };
  } catch (err) {
    showInfoModal("Izin Ditolak", "Mohon izinkan akses kamera.", "error");
  }
}
function stopCamera() {
  const stream = video.srcObject;
  if (stream) stream.getTracks().forEach((t) => t.stop());
  video.srcObject = null;
  isCameraOn = !1;
  video.style.display = "none";
  document.getElementById("initial-placeholder").classList.remove("hidden");
  captureBtn.disabled = !0;
  toggleCamBtn.innerHTML = '<i class="fa-solid fa-video-slash"></i>';
}
toggleCamBtn.addEventListener("click", () =>
  isCameraOn ? stopCamera() : startCamera(),
);
captureBtn.addEventListener("click", async () => {
  if (!isCameraOn) return;
  captureBtn.disabled = !0;
  captureBtn.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i> SCANNING...';
  video.pause();
  document.getElementById("scan-loading").classList.remove("hidden");
  setTimeout(async () => {
    try {
      const detections = await faceapi
        .detectAllFaces(video, SSD_OPTIONS)
        .withFaceLandmarks()
        .withFaceDescriptors();
      document.getElementById("scan-loading").classList.add("hidden");
      if (detections.length === 0) {
        showOverlay("error-overlay");
        return;
      }
      if (detections.length > 1) {
        showOverlay("multi-face-overlay");
        return;
      }
      const d = detections[0];
      if (d.detection.box.x < 20 || d.detection.box.y < 20) {
        showOverlay("boundary-overlay");
        return;
      }
      currentDescriptor = d.descriptor;
      drawSnapshot(d);
      processFace();
    } catch (e) {
      document.getElementById("scan-loading").classList.add("hidden");
      video.play();
      captureBtn.disabled = !1;
      captureBtn.innerHTML = '<i class="fa-solid fa-camera"></i> SCAN WAJAH';
    }
  }, 600);
});
function showOverlay(id) {
  document.getElementById(id).classList.add("active-overlay");
}
window.hideOverlays = function () {
  document
    .querySelectorAll(".error-overlay, .warning-overlay")
    .forEach((e) => e.classList.remove("active-overlay"));
  video.play();
  if (isCameraOn) {
    captureBtn.disabled = !1;
    captureBtn.innerHTML = '<i class="fa-solid fa-camera"></i> SCAN WAJAH';
  }
};
function drawSnapshot(detection) {
  const dims = { width: video.videoWidth, height: video.videoHeight };
  faceapi.matchDimensions(canvas, dims);
  canvas.style.display = "block";
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, dims.width, dims.height);
  const box = faceapi.resizeResults(detection, dims).detection.box;
  ctx.strokeStyle = "#34d399";
  ctx.lineWidth = 4;
  ctx.strokeRect(
    canvas.width - box.x - box.width,
    box.y,
    box.width,
    box.height,
  );
}
function processFace() {
  if (isUnlocking) return;
  if (document.getElementById("register-modal").classList.contains("active"))
    return;
  if (labeledDescriptors.length === 0) {
    triggerESP("akses-ditolak");
    showRegisterModal();
    return;
  }
  const matcher = new faceapi.FaceMatcher(labeledDescriptors, MATCH_THRESHOLD);
  const match = matcher.findBestMatch(currentDescriptor);
  const acc = Math.round((1 - match.distance) * 100);
  if (match.label !== "unknown") {
    isUnlocking = !0;
    triggerESP("buzzer-ok");
    showInfoModal(
      "Akses Diterima",
      `Halo <b>${match.label}</b><br>Akurasi: ${acc}%<br>Pintu terbuka 10 detik.`,
      "success",
    );
    triggerESP("door-unlock");
    kirimTelegram(
      match.label,
      acc,
      "AKSES DITERIMA",
      "🔓 Pintu Terbuka (Face ID)",
    );
    logToSpreadsheet(match.label, "FACE", "DITERIMA");
    console.log("⏳ Pintu terbuka, menunggu 10 detik...");
    setTimeout(() => {
      console.log("🔒 Pintu dikunci kembali otomatis.");
      closeModalAndReset();
      isUnlocking = !1;
    }, 10000);
  } else {
    triggerESP("akses-ditolak");
    kirimTelegram(
      "Tidak Dikenal",
      acc,
      "AKSES DITOLAK",
      "⛔ Pintu Tetap Terkunci",
    );
    showInfoModal("Akses Ditolak", "Wajah tidak dikenali sistem.", "error");
    logToSpreadsheet("Unknown User", "FACE", "DITOLAK");
  }
}
function logToSpreadsheet(name, type, status) {
  fetch(GAS_URL, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify({
      action: "log_access",
      name: name,
      type: type,
      status: status,
    }),
  })
    .then(() => console.log(`📝 Log Spreadsheet: ${name} - ${status}`))
    .catch((e) => console.error("Gagal Log Spreadsheet:", e));
}
function triggerESP(ep) {
  let command = "";
  if (ep === "kipas-on") command = "ON";
  else if (ep === "kipas-off") command = "OFF";
  else if (ep === "door-unlock") command = "DOOR_UNLOCK";
  else if (ep === "door-lock") command = "DOOR_LOCK";
  else if (ep === "akses-ditolak") command = "ACCESS_DENIED";
  else if (ep === "buzzer-ok") command = "BUZZER_OK";
  if (command && mqttClient.isConnected()) {
    console.log(`📤 MQTT Command: ${command}`);
    const message = new Paho.MQTT.Message(command);
    message.destinationName = "projek/belajar/perintah_kipas";
    mqttClient.send(message);
  } else {
    console.warn("MQTT disconnect / command unknown");
  }
}
function kirimTelegram(nama, acc, judul, statusPintu) {
  canvas.toBlob(
    (blob) => {
      const fd = new FormData();
      fd.append("chat_id", TELEGRAM_CHAT_ID);
      fd.append("photo", blob, "scan.jpg");
      fd.append(
        "caption",
        `✅ *${judul}*\n👤 ${nama}\n🎯 ${acc}%\n${statusPintu}`,
      );
      fd.append("parse_mode", "Markdown");
      fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
        method: "POST",
        body: fd,
      });
    },
    "image/jpeg",
    0.8,
  );
}
function sendTelegramText(text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=${encodeURIComponent(
    text,
  )}&parse_mode=Markdown`;
  fetch(url).catch((e) => console.error("Gagal kirim Telegram:", e));
}
saveBtn.addEventListener("click", async () => {
  if (labeledDescriptors.length >= 1) {
    showInfoModal("Penuh", "Maksimal 1 Wajah! Hapus via Telegram.", "error");
    return;
  }
  const name = nameInput.value.trim();
  if (!name) return showInfoModal("Error", "Nama tidak boleh kosong!", "error");
  setAppStatus("Menyimpan...", "loading");
  try {
    labeledDescriptors.push(
      new faceapi.LabeledFaceDescriptors(name, [currentDescriptor]),
    );
    triggerESP("buzzer-ok");
    kirimTelegram(name, 100, "PENDAFTARAN BARU", "✅ Wajah Berhasil Disimpan");
    await saveFacesToGitHub();
    await debugUploadGitHub();
    fetch(GAS_URL, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({ action: "add_face", name: name }),
    });
    document.getElementById("register-modal").classList.remove("active");
    renderList();
    showInfoModal(
      "Tersimpan",
      "Sukses! Data tersimpan di Cloud & Spreadsheet.",
      "success",
    );
    setAppStatus("Siap", "success");
  } catch (error) {
    console.error(error);
    setAppStatus("Gagal Menyimpan", "error");
    showInfoModal("Error", "Gagal menyimpan ke Cloud.", "error");
  }
});
function showRegisterModal() {
  nameInput.value = "";
  registerModal.classList.add("active");
  isUnlocking = !0;
  setTimeout(() => nameInput.focus(), 100);
}
window.askDelete = function (name) {
  modalTitle.innerText = "Hapus?";
  modalMsg.innerText = `Yakin hapus "${name}"?`;
  modalButtons.innerHTML = `<button onclick="globalModal.classList.remove('active')" class="flex-1 py-2 rounded bg-slate-700 text-white">Batal</button>
                              <button onclick="execDelete('${name}')" class="flex-1 py-2 rounded bg-red-600 text-white font-bold">Hapus</button>`;
  globalModal.classList.add("active");
};
window.execDelete = async function (name) {
  labeledDescriptors = labeledDescriptors.filter((d) => d.label !== name);
  metadata = metadata.filter((m) => m.name !== name);
  setAppStatus("Menghapus...", "loading");
  await saveFacesToGitHub();
  await debugUploadGitHub();
  renderList();
  globalModal.classList.remove("active");
  setAppStatus("Siap", "success");
};
window.confirmReset = function () {
  modalTitle.innerText = "Reset?";
  modalMsg.innerText = "Hapus SEMUA data wajah?";
  modalButtons.innerHTML = `<button onclick="globalModal.classList.remove('active')" class="flex-1 py-2 rounded bg-slate-700 text-white">Batal</button>
                              <button onclick="execReset()" class="flex-1 py-2 rounded bg-red-600 text-white font-bold">Reset</button>`;
  globalModal.classList.add("active");
};
window.execReset = async function () {
  labeledDescriptors = [];
  metadata = [];
  setAppStatus("Mereset...", "loading");
  await saveFacesToGitHub();
  renderList();
  globalModal.classList.remove("active");
  setAppStatus("Siap (Kosong)", "success");
};
async function loadFacesFromGitHub(isBackground = !1) {
  try {
    if (!isBackground) setAppStatus("Memuat Data Wajah...", "loading");
    const uniqueUrl = `https://api.github.com/repos/${GH_USERNAME}/${GH_REPO}/contents/${GH_DB_PATH}?t=${Date.now()}`;
    const res = await fetch(uniqueUrl, {
      method: "GET",
      headers: {
        Authorization: `token ${GH_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
      },
      cache: "no-store",
      mode: "cors",
    });
    if (res.ok) {
      const data = await res.json();
      const cleanContent = data.content.replace(/\s/g, "");
      const decodedContent = atob(cleanContent);
      let jsonDB;
      try {
        jsonDB = JSON.parse(decodedContent);
      } catch (err) {
        console.error("JSON Parse Error:", err);
        jsonDB = [];
      }
      if (!Array.isArray(jsonDB)) jsonDB = [];
      labeledDescriptors = jsonDB.map(
        (i) =>
          new faceapi.LabeledFaceDescriptors(
            i.label,
            i.descriptors.map((d) => new Float32Array(Object.values(d))),
          ),
      );
      renderList();
      if (!isBackground) setAppStatus("Siap", "success");
    } else if (res.status === 404) {
      console.log("Database wajah kosong/tidak ditemukan.");
      labeledDescriptors = [];
      renderList();
      if (!isBackground) setAppStatus("Siap (Kosong)", "success");
    } else {
      throw new Error(`GitHub API Error: ${res.status}`);
    }
  } catch (e) {
    console.error("Sync Error:", e);
    if (!isBackground) setAppStatus("Gagal Sinkronisasi", "error");
  }
}
setInterval(() => {
  loadFacesFromGitHub(!0);
}, 10000);
async function saveFacesToGitHub() {
  const url = `https://api.github.com/repos/${GH_USERNAME}/${GH_REPO}/contents/${GH_DB_PATH}`;
  const content = btoa(
    JSON.stringify(
      labeledDescriptors.map((ld) => ({
        label: ld.label,
        descriptors: ld.descriptors.map((d) => Array.from(d)),
      })),
    ),
  );
  let sha = null;
  try {
    const r = await fetch(url, {
      headers: { Authorization: `token ${GH_TOKEN}` },
    });
    if (r.ok) sha = (await r.json()).sha;
  } catch (e) {}
  const body = { message: "Update", content: content, branch: "main" };
  if (sha) body.sha = sha;
  await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `token ${GH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
function debugUploadGitHub() {
  const url = `https://api.github.com/repos/${GH_USERNAME}/${GH_REPO}/contents/${GH_EXCEL_PATH}`;
  fetch(url, { headers: { Authorization: `token ${GH_TOKEN}` } })
    .then((r) => (r.ok ? r.json() : null))
    .then(async (d) => {
      const wb = new ExcelJS.Workbook();
      let sha = d ? d.sha : null;
      if (d)
        await wb.xlsx.load(
          Uint8Array.from(atob(d.content.replace(/\s/g, "")), (c) =>
            c.charCodeAt(0),
          ).buffer,
        );
      let sh = wb.getWorksheet(1) || wb.addWorksheet("Data");
      const l = metadata[metadata.length - 1];
      if (l) {
        const row = sh.addRow([l.name, l.time]);
        const id = wb.addImage({ base64: l.image, extension: "jpeg" });
        sh.addImage(id, {
          tl: { col: 2, row: row.number - 1 },
          ext: { width: 160, height: 120 },
        });
        sh.getRow(row.number).height = 120;
        const buf = await wb.xlsx.writeBuffer();
        await fetch(url, {
          method: "PUT",
          headers: {
            Authorization: `token ${GH_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: "Excel",
            content: btoa(String.fromCharCode(...new Uint8Array(buf))),
            branch: "main",
            sha: sha,
          }),
        });
      }
      setAppStatus("Siap", "success");
    })
    .catch(() => {});
}
function renderList() {
  const ul = document.getElementById("user-list");
  ul.innerHTML = "";
  document.getElementById("count-display").innerText =
    labeledDescriptors.length;
  if (labeledDescriptors.length === 0) {
    ul.innerHTML =
      '<li class="text-xs text-center text-slate-600 italic">Kosong</li>';
    return;
  }
  labeledDescriptors.forEach((d) => {
    ul.innerHTML += `
        <li class="flex justify-between items-center bg-slate-800 p-3 rounded border border-slate-700">
            <span class="text-xs text-slate-200 font-bold"><i class="fa-solid fa-user-check mr-2 text-emerald-500"></i>${d.label}</span>
            <span class="text-[10px] text-slate-500 italic">Hapus via Telegram</span>
        </li>`;
  });
}
function sendSystemNotification(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    try {
      navigator.serviceWorker.ready.then(function (registration) {
        registration.showNotification(title, {
          body: body,
          icon: "https://cdn-icons-png.flaticon.com/512/241/241528.png",
          vibrate: [200, 100, 200],
          tag: "iot-alert",
        });
      });
    } catch (e) {
      console.log("Notifikasi Error:", e);
    }
  }
}
function showInfoModal(title, msg, type) {
  const mTitle = document.getElementById("modal-title"),
    mMsg = document.getElementById("modal-msg"),
    mIcon = document.getElementById("modal-icon"),
    mBg = document.getElementById("modal-icon-bg");
  mTitle.innerText = title;
  mMsg.innerHTML = msg;
  mIcon.className = "";
  if (type === "success") {
    mIcon.className = "fa-solid fa-check text-white";
    mBg.className =
      "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-emerald-500";
  } else if (type === "loading") {
    mIcon.className = "fa-solid fa-spinner fa-spin text-white";
    mBg.className =
      "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.8)]";
  } else if (type === "alarm") {
    mIcon.className = "fa-solid fa-bell text-white text-3xl animate-bounce";
    mBg.className =
      "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.8)]";
  } else if (type === "info") {
    mIcon.className = "fa-solid fa-info text-white";
    mBg.className =
      "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-blue-500";
  } else {
    mIcon.className = "fa-solid fa-triangle-exclamation text-white";
    mBg.className =
      "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-orange-500";
  }
  document.getElementById("modal-buttons").innerHTML =
    `<button onclick="closeModalAndReset()" class="w-full py-3 rounded-lg bg-slate-700 text-white font-bold hover:bg-slate-600">Tutup</button>`;
  document.getElementById("global-modal").classList.add("active");
}
window.closeModalAndReset = function () {
  document.getElementById("global-modal").classList.remove("active");
  if (canvas.style.display === "block") resetToCamera();
};
window.resetToCamera = function () {
  canvas.style.display = "none";
  video.play();
  document.getElementById("register-modal").classList.remove("active");
  currentDescriptor = null;
  if (isCameraOn) {
    captureBtn.disabled = !1;
    captureBtn.innerHTML = '<i class="fa-solid fa-camera"></i> SCAN WAJAH';
  }
};
helpBtn.addEventListener("click", () =>
  showInfoModal("Info", "Scan Wajah Untuk Buka Kunci", "info"),
);
lightBtn.addEventListener("click", () =>
  document.body.classList.toggle("flash-active"),
);
setInterval(() => {
  const now = new Date();
  const clockEl = document.getElementById("live-clock");
  if (clockEl) {
    clockEl.innerText = now.toLocaleTimeString("id-ID");
  }
}, 1000);
setInterval(() => {
  if (currentLat && currentLon) {
    console.log("Auto-Refreshing Weather Data...");
    const currentLocName = document.getElementById("locName").innerText;
    fetchWeather(currentLat, currentLon, !1, currentLocName);
  }
}, 60000);
let fanSchedules = JSON.parse(localStorage.getItem("fanSchedules")) || [];
function saveToLocal() {
  localStorage.setItem("fanSchedules", JSON.stringify(fanSchedules));
}
function uploadScheduleToCloud() {
  saveToLocal();
  if (mqttClient.isConnected()) {
    console.log("📤 MQTT: Mengirim data jadwal...");
    const payload = JSON.stringify(fanSchedules);
    const message = new Paho.MQTT.Message(payload);
    message.destinationName = mqtt_topic_schedule;
    message.retained = !0;
    mqttClient.send(message);
  }
}
function toggleAllDays(source) {
  const checkboxes = document.querySelectorAll(".day-chk");
  checkboxes.forEach((cb) => (cb.checked = source.checked));
}
function saveSchedule() {
  const time = document.getElementById("sched-time").value;
  const action = document.getElementById("sched-action").value;
  const days = Array.from(document.querySelectorAll(".day-chk:checked")).map(
    (cb) => parseInt(cb.value),
  );
  if (!time || days.length === 0) {
    return showInfoModal(
      "Data Kurang",
      "Pilih jam dan minimal satu hari!",
      "error",
    );
  }
  const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const daysStr =
    days.length === 7 ? "Setiap Hari" : days.map((d) => dayNames[d]).join(", ");
  if (editingScheduleId) {
    fanSchedules = fanSchedules.filter((s) => s.id !== editingScheduleId);
    fanSchedules.push({
      id: editingScheduleId,
      time,
      action,
      days,
      active: !0,
    });
    sendTelegramText(
      `📝 *JADWAL DIUBAH*\n\n⏰ Jam: ${time}\n⚡ Aksi: ${action}\n📅 Hari: ${daysStr}\n\n_Diupdate via Web Dashboard_`,
    );
    editingScheduleId = null;
  } else {
    fanSchedules.push({ id: Date.now(), time, action, days, active: !0 });
    sendTelegramText(
      `➕ *JADWAL BARU*\n\n⏰ Jam: ${time}\n⚡ Aksi: ${action}\n📅 Hari: ${daysStr}\n\n_Ditambahkan via Web Dashboard_`,
    );
  }
  uploadScheduleToCloud();
  closeScheduleModal();
  document.getElementById("sched-time").value = "";
  document.querySelectorAll(".day-chk").forEach((cb) => (cb.checked = !1));
  renderSchedules();
}
function deleteSchedule(id) {
  const mTitle = document.getElementById("modal-title");
  const mMsg = document.getElementById("modal-msg");
  const mIcon = document.getElementById("modal-icon");
  const mBg = document.getElementById("modal-icon-bg");
  const mButtons = document.getElementById("modal-buttons");
  mTitle.innerText = "Hapus Jadwal?";
  mMsg.innerText = "Apakah Anda yakin ingin menghapus jadwal otomatis ini?";
  mIcon.className = "fa-solid fa-trash text-white";
  mBg.className =
    "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-red-600";
  mButtons.innerHTML = `
        <button onclick="document.getElementById('global-modal').classList.remove('active')" class="flex-1 py-3 rounded-lg bg-slate-700 text-white font-bold hover:bg-slate-600 transition">Batal</button>
        <button onclick="execDeleteSchedule(${id})" class="flex-1 py-3 rounded-lg bg-red-600 text-white font-bold hover:bg-red-500 transition shadow-lg shadow-red-900/50">Hapus</button>
    `;
  document.getElementById("global-modal").classList.add("active");
}
function toggleScheduleActive(id, isChecked) {
  const target = fanSchedules.find((s) => s.id === id);
  if (target) {
    target.active = isChecked;
    uploadScheduleToCloud();
    console.log(
      `Status Jadwal ID ${id} diubah menjadi: ${isChecked ? "ON" : "OFF"}`,
    );
    if (navigator.vibrate) navigator.vibrate(30);
  }
}
function execDeleteSchedule(id) {
  const target = fanSchedules.find((s) => s.id === id);
  if (target) {
    sendTelegramText(
      `🗑️ *JADWAL DIHAPUS*\n\n⏰ Jam: ${target.time}\n⚡ Aksi: ${target.action}\n\n_Dihapus via Web Dashboard_`,
    );
  }
  console.log("🗑️ Menghapus jadwal ID:", id);
  fanSchedules = fanSchedules.filter((s) => s.id !== id);
  uploadScheduleToCloud();
  renderSchedules();
  document.getElementById("global-modal").classList.remove("active");
  setTimeout(() => {
    showInfoModal("Berhasil", "Jadwal telah dihapus.", "success");
  }, 300);
}
function renderSchedules() {
  const list = document.getElementById("schedule-list");
  if (!list) return;
  list.innerHTML = "";
  if (fanSchedules.length === 0) {
    list.innerHTML =
      '<li class="text-center text-xs text-slate-500 py-4 italic">Belum ada jadwal tersimpan (Cloud).</li>';
    return;
  }
  const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  fanSchedules
    .sort((a, b) => a.time.localeCompare(b.time))
    .forEach((s) => {
      const daysStr =
        s.days.length === 7
          ? "Setiap Hari"
          : s.days.map((d) => dayNames[d]).join(", ");
      let actionLabel = "";
      let colorClass = "";
      let badgeClass = "";
      if (s.action === "1") {
        actionLabel = "SPEED 1";
        colorClass = "text-emerald-400";
        badgeClass = "bg-emerald-500/10 border-emerald-500/30";
      } else if (s.action === "2") {
        actionLabel = "SPEED 2";
        colorClass = "text-blue-400";
        badgeClass = "bg-blue-500/10 border-blue-500/30";
      } else if (s.action === "3") {
        actionLabel = "SPEED 3";
        colorClass = "text-orange-400";
        badgeClass = "bg-orange-500/10 border-orange-500/30";
      } else {
        actionLabel = "OFF";
        colorClass = "text-red-400";
        badgeClass = "bg-red-500/10 border-red-500/30";
      }
      if (s.active === undefined) s.active = !0;
      const isChecked = s.active ? "checked" : "";
      const opacityClass = s.active ? "opacity-100" : "opacity-50 grayscale";
      list.innerHTML += `
      <li class="flex flex-col gap-3 bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-sm mb-2 transition-all ${opacityClass}">
          
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
                <span class="text-2xl font-bold text-white tracking-wide">${s.time}</span>
                <span class="text-[10px] px-2 py-1 rounded border ${badgeClass} ${colorClass} font-bold whitespace-nowrap">${actionLabel}</span>
            </div>
            
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" class="sr-only peer" ${isChecked} onchange="toggleScheduleActive(${s.id}, this.checked)">
              <div class="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full border border-slate-600 peer-checked:border-emerald-500"></div>
            </label>
          </div>

          <div class="flex items-center justify-between pt-2 border-t border-slate-700/50">
            <div class="text-xs text-slate-400 truncate pr-2"><i class="fa-regular fa-calendar mr-1"></i> ${daysStr}</div>
            
            <div class="flex items-center gap-1">
                 <button onclick="editSchedule(${s.id})" class="w-8 h-8 rounded-lg bg-slate-700/50 text-slate-400 hover:text-yellow-400 hover:bg-slate-700 flex items-center justify-center transition border border-transparent hover:border-slate-600">
                    <i class="fa-solid fa-pen text-xs"></i>
                 </button>
                <button onclick="deleteSchedule(${s.id})" class="w-8 h-8 rounded-lg bg-slate-700/50 text-slate-400 hover:text-red-400 hover:bg-slate-700 flex items-center justify-center transition border border-transparent hover:border-slate-600">
                    <i class="fa-solid fa-trash text-xs"></i>
                </button>
            </div>
          </div>
      </li>`;
    });
}
let editingScheduleId = null;
function openScheduleModal(isEdit = !1) {
  const modal = document.getElementById("schedule-modal");
  const title = document.getElementById("schedule-modal-title");
  const btn = document.getElementById("btn-save-schedule");
  if (isEdit) {
    title.innerText = "Edit Jadwal";
    btn.innerText = "Update Perubahan";
  } else {
    editingScheduleId = null;
    document.getElementById("sched-action").value = "1";
    document.getElementById("sched-time").value = "";
    document.getElementById("sched-action").value = "ON";
    document.querySelectorAll(".day-chk").forEach((cb) => (cb.checked = !1));
    title.innerText = "Tambah Jadwal Baru";
    btn.innerText = "Simpan Jadwal";
  }
  modal.classList.add("active");
}
function closeScheduleModal() {
  document.getElementById("schedule-modal").classList.remove("active");
}
function editSchedule(id) {
  const s = fanSchedules.find((item) => item.id === id);
  if (!s) return;
  editingScheduleId = id;
  document.getElementById("sched-time").value = s.time;
  document.getElementById("sched-action").value = s.action;
  document.querySelectorAll(".day-chk").forEach((cb) => {
    cb.checked = s.days.includes(parseInt(cb.value));
  });
  openScheduleModal(!0);
}
setInterval(() => {
  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours().toString().padStart(2, "0");
  const currentMin = now.getMinutes().toString().padStart(2, "0");
  const currentTime = `${currentHour}:${currentMin}`;
  fanSchedules.forEach((s) => {
    if (s.active && s.days.includes(currentDay)) {
      if (s.time === currentTime) {
        if (s.lastTriggered !== currentTime) {
          console.log(
            `%c ✅ JADWAL MATCH! ID: ${s.id}`,
            "color: green; font-weight: bold; font-size: 14px",
          );
          console.log(`   -> Waktu: ${s.time}`);
          console.log(`   -> Aksi: Speed ${s.action}`);
          let speedVal = parseInt(s.action);
          if (isNaN(speedVal)) speedVal = 0;
          controlFan(speedVal);
          console.log(`   -> 📤 Perintah MQTT Dikirim: ${speedVal}`);
          s.lastTriggered = currentTime;
        }
      }
    }
  });
}, 1000);
window.addEventListener("load", renderSchedules);
// --- LOGIKA BIOMETRIK OTOMATIS (SAFE MODE) ---
window.addEventListener("DOMContentLoaded", () => {
  const title = document.getElementById("lock-title");
  const msg = document.getElementById("lock-msg");

  // Set UI awal
  if (title) title.innerText = "LOCKED";
  if (msg) msg.innerText = "Memindai Sidik Jari...";

  // Cek ketersediaan fitur biometrik
  if (window.PublicKeyCredential) {
    PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(
      (available) => {
        if (available) {
          console.log("Biometrik tersedia.");

          let isScanning = false;

          // Fungsi pemicu yang aman
          const safeTrigger = async () => {
            // Jika sedang scanning, hentikan agar tidak tumpang tindih
            if (isScanning) return;
            isScanning = true;

            console.log("Memicu Biometrik...");
            try {
              await verifyBiometric();
              // Jika sukses, isScanning akan direset saat lock screen hilang
            } catch (e) {
              console.log("Scan dibatalkan/gagal, siap untuk scan ulang.");
              // Reset status agar bisa dipicu lagi lewat klik
              isScanning = false;
            }
          };

          // 1. AUTO-START (Otomatis Jalan)
          // Kita beri jeda 1 detik agar Jendela Mengambang stabil dulu
          setTimeout(() => {
            // Cek apakah Lock Screen masih ada
            const lockScreen = document.getElementById("lock-screen");
            // Hanya trigger otomatis jika aplikasi terlihat (Visible)
            if (
              document.visibilityState === "visible" &&
              lockScreen &&
              lockScreen.style.transform !== "translateY(-100%)"
            ) {
              safeTrigger();
            }
          }, 1000);

          // 2. MANUAL CLICK (Cadangan)
          // Jika auto-start gagal (karena limitasi OS di floating window),
          // user tetap bisa klik layar.
          document.addEventListener("click", (e) => {
            // Cek apakah yang diklik adalah area Lock Screen
            const lockScreen = document.getElementById("lock-screen");
            if (
              lockScreen &&
              lockScreen.contains(e.target) &&
              lockScreen.style.transform !== "translateY(-100%)"
            ) {
              safeTrigger();
            }
          });
        } else {
          if (msg) msg.innerText = "Gunakan PIN (Biometrik tidak tersedia)";
        }
      },
    );
  }
});
connectMQTT();
initMap();
window.onload = function () {
  getMyLocation();
};
let currentFanSpeed = -1;
function updateFanUI(speed) {
  for (let i = 0; i <= 3; i++) {
    const btn = document.getElementById(`btn-fan-${i}`);
    if (btn) {
      btn.classList.remove(
        "bg-emerald-600",
        "bg-red-600",
        "text-white",
        "ring-2",
        "ring-emerald-400",
        "shadow-lg",
      );
      btn.classList.add("bg-slate-700", "text-slate-200");
      if (i === 0) {
        btn.classList.add(
          "bg-red-900/50",
          "text-red-200",
          "border",
          "border-red-800",
        );
        btn.classList.remove("bg-slate-700", "text-slate-200");
      }
    }
  }
  const activeBtn = document.getElementById(`btn-fan-${speed}`);
  if (activeBtn) {
    activeBtn.classList.remove(
      "bg-slate-700",
      "text-slate-200",
      "bg-red-900/50",
      "text-red-200",
      "border",
      "border-red-800",
    );
    if (speed === 0) {
      activeBtn.classList.add("bg-red-600", "text-white", "shadow-lg");
    } else {
      activeBtn.classList.add(
        "bg-emerald-600",
        "text-white",
        "ring-2",
        "ring-emerald-400",
        "shadow-lg",
      );
    }
  }
}
function controlFan(speed, isSilent = !1) {
  if (!mqttClient.isConnected())
    return showInfoModal("Error", "MQTT Terputus", "error");
  updateFanUI(speed);
  currentFanSpeed = speed;
  const message = new Paho.MQTT.Message(String(speed));
  message.destinationName = mqtt_topic_fan_ctrl;
  message.retained = !0;
  mqttClient.send(message);
  if (!isSilent) {
    showInfoModal("Terkirim", `Kipas Speed ${speed} aktif!`, "success");
  }
}
function toggleSecurity(type, isActive, isSilent = !1) {
  if (!mqttClient.isConnected()) {
    console.error("❌ Gagal: MQTT Terputus");
    return showInfoModal("Error", "MQTT Terputus", "error");
  }
  let command = "";
  if (type === "laser") {
    command = isActive ? "/keamananON" : "/keamananOFF";
  } else if (type === "ir") {
    command = isActive ? "/irON" : "/irOFF";
  } else if (type === "hc") {
    command = isActive ? "/sensorHCON" : "/sensorHCOFF";
  } else if (type === "api") {
    command = isActive ? "/apiON" : "/apiOFF";
  }
  if (command !== "") {
    const message = new Paho.MQTT.Message(command);
    message.destinationName = mqtt_topic_security_ctrl;
    mqttClient.send(message);
    console.log(`✅ BERHASIL: Perintah '${command}' dikirim.`);
    if (!isSilent) {
      showInfoModal(
        "Sukses",
        `Sensor ${type.toUpperCase()} diubah.`,
        "success",
      );
    }
  } else {
    console.warn(`⚠️ Sensor '${type}' tidak dikenali.`);
  }
}
function controlDoor(action, isSilent = !1) {
  if (!mqttClient.isConnected())
    return showInfoModal("Error", "MQTT Terputus", "error");
  let cmd = action === "UNLOCK" ? "DOOR_UNLOCK" : "DOOR_LOCK";
  if (action === "UNLOCK") {
    isDoorLocked = !1;
  } else {
    isDoorLocked = !0;
  }
  const message = new Paho.MQTT.Message(cmd);
  message.destinationName = mqtt_topic_security_ctrl;
  mqttClient.send(message);
  if (!isSilent) {
    showInfoModal("Pintu", `Perintah ${action} dikirim.`, "success");
  }
}
const handVideo = document.getElementById("hand-video");
const handCanvas = document.getElementById("hand-canvas");
let handCtx = null;
if (handCanvas) handCtx = handCanvas.getContext("2d");
let isHandCameraOn = !1;
let handCameraObj = null;
let handsAI = null;
let isAiReady = !1;
let lastHandGesture = -1;
let gestureStabilityCount = 0;
const GESTURE_THRESHOLD = 20;
let lastCommandTime = 0;
const COMMAND_COOLDOWN = 2000;
function initHandAI() {
  if (!handsAI) {
    handsAI = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`;
      },
    });
    handsAI.setOptions({
      maxNumHands: 1,
      modelComplexity: 0,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    handsAI.onResults(onHandResults);
  }
}
function onHandResults(results) {
  handCanvas.width = handVideo.videoWidth;
  handCanvas.height = handVideo.videoHeight;
  handCtx.save();
  handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);
  if (isHandCameraOn) {
    handCtx.drawImage(results.image, 0, 0, handCanvas.width, handCanvas.height);
  }
  if (!isAiReady && isHandCameraOn) {
    isAiReady = !0;
    document.getElementById("hand-status-text").innerText =
      "✅ AI SIAP! Tunjukkan Tangan.";
    document.getElementById("hand-status-text").className =
      "text-sm font-bold text-emerald-400 mt-3 animate-pulse";
    document.getElementById("hand-loading").classList.add("hidden");
  }
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0];
    const handedness = results.multiHandedness[0].label;
    drawConnectors(handCtx, landmarks, HAND_CONNECTIONS, {
      color: "#00f2ff",
      lineWidth: 2,
    });
    drawLandmarks(handCtx, landmarks, {
      color: "#ffffff",
      lineWidth: 1,
      radius: 4,
    });
    let fingers = 0;
    if (handedness === "Right") {
      if (landmarks[4].x < landmarks[3].x) fingers++;
    } else {
      if (landmarks[4].x > landmarks[3].x) fingers++;
    }
    const tips = [8, 12, 16, 20];
    const pips = [6, 10, 14, 18];
    for (let i = 0; i < tips.length; i++) {
      if (landmarks[tips[i]].y < landmarks[pips[i]].y) {
        fingers++;
      }
    }
    document.getElementById("hand-count-display").innerText = fingers;
    const statusText = document.getElementById("hand-status-text");
    if (fingers === lastHandGesture) {
      gestureStabilityCount++;
      if (
        gestureStabilityCount > 5 &&
        gestureStabilityCount < GESTURE_THRESHOLD
      ) {
        let progress = Math.round(
          (gestureStabilityCount / GESTURE_THRESHOLD) * 100,
        );
        statusText.innerText = `Menahan... ${progress}%`;
        statusText.className = "text-sm font-bold text-yellow-400 mt-3";
      }
    } else {
      lastHandGesture = fingers;
      gestureStabilityCount = 0;
      statusText.innerText = "Mendeteksi...";
      statusText.className = "text-sm font-bold text-white mt-3";
    }
    if (gestureStabilityCount === GESTURE_THRESHOLD) {
      const now = Date.now();
      if (now - lastCommandTime > COMMAND_COOLDOWN) {
        executeHandCommand(fingers);
        lastCommandTime = now;
      } else {
        statusText.innerText = "⏳ Tunggu Sebentar...";
        statusText.className = "text-sm text-gray-400 mt-3";
      }
    }
  } else {
    document.getElementById("hand-count-display").innerText = "-";
    gestureStabilityCount = 0;
    lastHandGesture = -1;
    if (isAiReady) {
      document.getElementById("hand-status-text").innerText =
        "Menunggu Tangan...";
      document.getElementById("hand-status-text").className =
        "text-sm text-slate-400 mt-3";
    }
  }
  handCtx.restore();
}
function executeHandCommand(fingers) {
  const statusText = document.getElementById("hand-status-text");
  statusText.className =
    "text-sm font-bold text-emerald-400 mt-3 animate-pulse";
  if (fingers === 1) {
    statusText.innerText = "✅ SPEED 1 AKTIF";
    controlFan(1);
  } else if (fingers === 2) {
    statusText.innerText = "✅ SPEED 2 AKTIF";
    controlFan(2);
  } else if (fingers === 3) {
    statusText.innerText = "✅ SPEED 3 AKTIF";
    controlFan(3);
  } else if (fingers === 4) {
    statusText.innerText = "🔴 KIPAS OFF";
    controlFan(0);
  } else if (fingers === 5) {
    statusText.innerText = "🔓 MEMBUKA PINTU...";
    triggerESP("door-unlock");
    showInfoModal("Akses Tangan", "Pintu Terbuka 10 Detik", "success");
    setTimeout(() => {
      console.log("🔒 Pintu dikunci kembali (Auto-Timer Hand)");
    }, 10000);
  } else {
    statusText.innerText = "⚠️ TIDAK DIKENAL";
    statusText.className = "text-sm font-bold text-red-400 mt-3 animate-bounce";
    if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
  }
}
function toggleHandCamera() {
  const btn = document.getElementById("toggle-hand-btn");
  const placeholder = document.getElementById("hand-placeholder");
  const loading = document.getElementById("hand-loading");
  if (isHandCameraOn) {
    stopHandCamera();
  } else {
    initHandAI();
    isAiReady = !1;
    placeholder.classList.add("hidden");
    loading.classList.remove("hidden");
    btn.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin"></i> MENYIAPKAN AI...';
    btn.disabled = !0;
    if (!handCameraObj) {
      handCameraObj = new Camera(handVideo, {
        onFrame: async () => {
          const now = Date.now();
          if (now - lastHandCheck < HAND_CHECK_FPS) return;
          lastHandCheck = now;
          if (handsAI) {
            await handsAI.send({ image: handVideo });
          }
        },
        width: 320,
        height: 240,
      });
    }
    handCameraObj
      .start()
      .then(() => {
        handVideo.style.display = "block";
        isHandCameraOn = !0;
        btn.innerHTML = '<i class="fa-solid fa-power-off"></i> MATIKAN KAMERA';
        btn.classList.replace("bg-blue-600", "bg-red-600");
        btn.classList.replace("hover:bg-blue-500", "hover:bg-red-500");
        btn.disabled = !1;
      })
      .catch((err) => {
        console.error("Camera Error:", err);
        stopHandCamera();
        showInfoModal("Gagal", "Kamera error atau izin ditolak.", "error");
      });
  }
}
function stopHandCamera() {
  isHandCameraOn = !1;
  isAiReady = !1;
  if (handVideo.srcObject) {
    const tracks = handVideo.srcObject.getTracks();
    tracks.forEach((track) => track.stop());
    handVideo.srcObject = null;
  }
  if (handCameraObj) {
    try {
      handCameraObj.stop();
    } catch (e) {
      console.log("Camera stop handled");
    }
  }
  const btn = document.getElementById("toggle-hand-btn");
  const placeholder = document.getElementById("hand-placeholder");
  const loading = document.getElementById("hand-loading");
  const statusText = document.getElementById("hand-status-text");
  const countDisplay = document.getElementById("hand-count-display");
  handVideo.style.display = "none";
  placeholder.classList.remove("hidden");
  loading.classList.add("hidden");
  if (handCtx) handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);
  if (btn) {
    btn.innerHTML = '<i class="fa-solid fa-power-off"></i> AKTIFKAN KAMERA';
    btn.classList.replace("bg-red-600", "bg-blue-600");
    btn.classList.replace("hover:bg-red-500", "hover:bg-blue-500");
    btn.disabled = !1;
  }
  if (statusText) {
    statusText.innerText = "Menunggu...";
    statusText.className = "text-sm font-bold text-white mt-3";
  }
  if (countDisplay) countDisplay.innerText = "-";
}
function openRfidModal() {
  document.getElementById("rfid-modal").classList.add("active");
}
function closeRfidModal() {
  document.getElementById("rfid-modal").classList.remove("active");
}
async function saveNewCard() {
  const uid = document.getElementById("rfid-uid").value.trim();
  const name = document.getElementById("rfid-name").value.trim();
  const btn = document.getElementById("btn-save-rfid");
  if (!uid || !name) return alert("Isi UID dan Nama!");
  btn.innerText = "Menyimpan...";
  try {
    await fetch(GAS_URL, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({ action: "add_rfid", uid: uid, name: name }),
    });
    closeRfidModal();
    showInfoModal(
      "Berhasil",
      `Kartu milik <b>${name}</b> berhasil disimpan ke Cloud!<br>Alat sedang sinkronisasi...`,
      "success",
    );
    document.getElementById("rfid-uid").value = "";
    document.getElementById("rfid-name").value = "";
    const message = new Paho.MQTT.Message("REFRESH_DB");
    message.destinationName = "projek/belajar/perintah_kipas";
    mqttClient.send(message);
  } catch (e) {
    showInfoModal("Gagal", "Tidak dapat terhubung ke Spreadsheet.", "error");
  }
  btn.innerText = "Simpan Kartu";
}
function forceSync() {
  if (typeof mqttClient === "undefined" || !mqttClient.isConnected()) {
    showInfoModal("Gagal", "MQTT tidak terhubung. Cek internet.", "error");
    return;
  }
  closeRfidModal();
  const message = new Paho.MQTT.Message("REFRESH_DB");
  message.destinationName = "projek/belajar/perintah_kipas";
  mqttClient.send(message);
  showInfoModal(
    "Sinkronisasi",
    "Perintah dikirim ke ESP!<br>Alat sedang mendownload data terbaru dari Spreadsheet...<br>(Tunggu ±5-10 detik)",
    "info",
  );
  console.log("📤 Perintah REFRESH_DB dikirim manual.");
}
async function syncFacesToSheet() {
  if (labeledDescriptors.length === 0) {
    return showInfoModal(
      "Info",
      "Tidak ada data wajah untuk disinkronkan.",
      "info",
    );
  }
  const btn = document.getElementById("btn-sync-face");
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Proses...';
  btn.disabled = !0;
  let successCount = 0;
  for (let face of labeledDescriptors) {
    const name = face.label;
    try {
      await fetch(GAS_URL, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify({ action: "add_face", name: name }),
      });
      console.log(`✅ ${name} dikirim ke Sheet`);
      successCount++;
      await new Promise((r) => setTimeout(r, 500));
    } catch (e) {
      console.error(`Gagal sync ${name}`);
    }
  }
  btn.innerHTML = originalText;
  btn.disabled = !1;
  showInfoModal(
    "Selesai",
    `Berhasil mengirim ${successCount} data wajah ke Spreadsheet.`,
    "success",
  );
}
function kirimIR(hexCode) {
  if (!mqttClient.isConnected()) {
    showInfoModal("Gagal", "MQTT Terputus. Cek koneksi internet.", "error");
    return;
  }
  if (navigator.vibrate) navigator.vibrate(50);
  const message = new Paho.MQTT.Message(hexCode);
  message.destinationName = mqtt_topic_ir_send;
  mqttClient.send(message);
  console.log(`📡 IR Sent: ${hexCode}`);
}
let remoteDashboards =
  JSON.parse(localStorage.getItem("remoteDashboards")) || [];
let activeDashboardId = null;
window.addEventListener("load", () => {
  let oldRemotes = JSON.parse(localStorage.getItem("myRemotes"));
  if (oldRemotes && oldRemotes.length > 0 && remoteDashboards.length === 0) {
    const migrationId = Date.now();
    remoteDashboards.push({
      id: migrationId,
      name: "Remote Lama (Migrasi)",
      type: "other",
      brand: "Universal",
      buttons: oldRemotes,
    });
    localStorage.setItem("remoteDashboards", JSON.stringify(remoteDashboards));
    localStorage.removeItem("myRemotes");
  }
  renderDashboardList();
});
function openAddDashboardModal() {
  document.getElementById("dash-name").value = "";
  document.getElementById("dash-brand").value = "";
  document.getElementById("add-dashboard-modal").classList.add("active");
}
function closeAddDashboardModal() {
  document.getElementById("add-dashboard-modal").classList.remove("active");
}
function createNewDashboard() {
  const name = document.getElementById("dash-name").value.trim();
  const type = document.getElementById("dash-type").value;
  const brand = document.getElementById("dash-brand").value.trim() || "Generic";
  if (!name) return showInfoModal("Error", "Nama Remote wajib diisi!", "error");
  const newDash = {
    id: Date.now(),
    name: name,
    type: type,
    brand: brand,
    buttons: [],
  };
  remoteDashboards.push(newDash);
  saveDashboards();
  closeAddDashboardModal();
  renderDashboardList();
  showInfoModal("Berhasil", `Remote "${name}" dibuat!`, "success");
}
function saveDashboards() {
  localStorage.setItem("remoteDashboards", JSON.stringify(remoteDashboards));
}
function renderDashboardList() {
  const list = document.getElementById("dashboard-list");
  if (!list) return;
  list.innerHTML = "";
  if (remoteDashboards.length === 0) {
    list.innerHTML = `<div class="text-center p-8 border-2 border-dashed border-slate-700 rounded-xl text-slate-500 text-sm">Belum ada remote. Buat baru!</div>`;
    return;
  }
  remoteDashboards.forEach((dash) => {
    let iconClass = "fa-tower-broadcast";
    let colorClass = "text-slate-400";
    let bgClass = "bg-slate-800";
    if (dash.type === "tv") {
      iconClass = "fa-tv";
      colorClass = "text-blue-400";
    } else if (dash.type === "ac") {
      iconClass = "fa-snowflake";
      colorClass = "text-cyan-400";
    } else if (dash.type === "fan") {
      iconClass = "fa-fan";
      colorClass = "text-emerald-400";
    } else if (dash.type === "light") {
      iconClass = "fa-lightbulb";
      colorClass = "text-yellow-400";
    } else if (dash.type === "speaker") {
      iconClass = "fa-music";
      colorClass = "text-purple-400";
    }
    list.innerHTML += `
      <div onclick="openDashboardDetail(${dash.id})" class="bg-slate-800 border border-slate-700 p-4 rounded-xl shadow-md hover:border-emerald-500/50 transition cursor-pointer flex items-center justify-between group active:scale-95">
        <div class="flex items-center gap-4">
           <div class="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center ${colorClass} text-xl shadow-inner">
              <i class="fa-solid ${iconClass}"></i>
           </div>
           <div>
              <h4 class="font-bold text-white text-lg">${dash.name}</h4>
              <p class="text-xs text-slate-500 uppercase tracking-wide font-bold">${dash.brand} &bull; ${dash.buttons.length} Tombol</p>
           </div>
        </div>
        <i class="fa-solid fa-chevron-right text-slate-600 group-hover:text-emerald-500 transition"></i>
      </div>
    `;
  });
}
function openDashboardDetail(id) {
  const dash = remoteDashboards.find((d) => d.id === id);
  if (!dash) return;
  activeDashboardId = id;
  document.getElementById("detail-remote-name").innerText = dash.name;
  document.getElementById("detail-remote-type").innerText = `${
    dash.brand
  } - ${dash.type.toUpperCase()}`;
  document.getElementById("view-remote-list").classList.add("hidden");
  document.getElementById("view-remote-detail").classList.remove("hidden");
  renderCustomRemotes();
}
function backToDashboardList() {
  activeDashboardId = null;
  document.getElementById("view-remote-detail").classList.add("hidden");
  document.getElementById("view-remote-list").classList.remove("hidden");
  renderDashboardList();
}
function deleteCurrentDashboard() {
  const dash = remoteDashboards.find((d) => d.id === activeDashboardId);
  if (!dash) return;
  const mTitle = document.getElementById("modal-title");
  const mMsg = document.getElementById("modal-msg");
  const mButtons = document.getElementById("modal-buttons");
  const mIcon = document.getElementById("modal-icon");
  mTitle.innerText = "Hapus Remote?";
  mMsg.innerHTML = `Hapus remote <b>${dash.name}</b> beserta semua tombolnya?`;
  mIcon.className = "fa-solid fa-trash text-white";
  mButtons.innerHTML = `
    <button onclick="closeModalAndReset()" class="flex-1 py-3 rounded-lg bg-slate-700 text-white font-bold">Batal</button>
    <button onclick="execDeleteDashboard()" class="flex-1 py-3 rounded-lg bg-red-600 text-white font-bold">Hapus</button>
  `;
  document.getElementById("global-modal").classList.add("active");
}
function execDeleteDashboard() {
  remoteDashboards = remoteDashboards.filter((d) => d.id !== activeDashboardId);
  saveDashboards();
  closeModalAndReset();
  backToDashboardList();
  showInfoModal("Terhapus", "Remote berhasil dihapus.", "success");
}
function saveLearnedButton() {
  if (!activeDashboardId) return;
  const dash = remoteDashboards.find((d) => d.id === activeDashboardId);
  const nameInput = document.getElementById("new-remote-name");
  const name = nameInput.value.trim();
  if (!lastCapturedRawData)
    return showInfoModal("Belum Scan", "Scan sinyal dulu!", "error");
  if (!name) return showInfoModal("Nama Kosong", "Isi nama tombol!", "error");
  if (dash.buttons.some((b) => b.name.toLowerCase() === name.toLowerCase())) {
    return showInfoModal(
      "Nama Terpakai",
      "Nama tombol sudah ada di remote ini.",
      "error",
    );
  }
  dash.buttons.push({
    id: Date.now(),
    name: name,
    code: lastCapturedRawData,
    hex: lastCapturedHex,
    type: "RAW",
  });
  saveDashboards();
  nameInput.value = "";
  lastCapturedRawData = null;
  lastCapturedHex = null;
  document.getElementById("scanned-code-display").innerHTML =
    "Menunggu Sinyal...";
  document.getElementById("raw-size-info").innerText = "Buffer Kosong";
  renderCustomRemotes();
  showInfoModal("Sukses", "Tombol ditambahkan!", "success");
}
function renderCustomRemotes() {
  const container = document.getElementById("custom-buttons-list");
  const countEl = document.getElementById("total-buttons-detail");
  if (!container || !activeDashboardId) return;
  const dash = remoteDashboards.find((d) => d.id === activeDashboardId);
  const buttons = dash ? dash.buttons : [];
  container.innerHTML = "";
  if (countEl) countEl.innerText = `${buttons.length} Tombol`;
  if (buttons.length === 0) {
    container.innerHTML =
      '<div class="col-span-2 text-center text-xs text-slate-500 italic py-4">Belum ada tombol di remote ini.</div>';
    return;
  }
  buttons.forEach((btn) => {
    const div = document.createElement("div");
    div.className =
      "bg-slate-700/50 rounded-xl p-3 border border-slate-600 shadow-sm relative group";
    div.innerHTML = `
      <div class="flex justify-between items-start mb-2">
         <div class="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-emerald-400 text-xs font-bold border border-slate-600">
           <i class="fa-solid fa-power-off"></i>
         </div>
         <div class="flex gap-1">
             <button onclick="openEditButtonModal('${btn.id}')" class="text-slate-500 hover:text-yellow-400 transition px-1">
                <i class="fa-solid fa-pen text-xs"></i>
             </button>
             <button onclick="deleteCustomButton('${btn.id}')" class="text-slate-500 hover:text-red-400 transition px-1">
                <i class="fa-solid fa-times text-xs"></i>
             </button>
         </div>
      </div>
      <h4 class="text-white font-bold text-sm truncate mb-3">${btn.name}</h4>
      <button onclick="kirimIR_RAW('${btn.id}')" class="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow active:scale-95 transition">
         TEKAN
      </button>
    `;
    container.appendChild(div);
  });
}
function openEditDashboardModal() {
  if (!activeDashboardId) return;
  const dash = remoteDashboards.find((d) => d.id === activeDashboardId);
  if (!dash) return;
  document.getElementById("edit-dash-name").value = dash.name;
  document.getElementById("edit-dash-brand").value = dash.brand;
  document.getElementById("edit-dash-type").value = dash.type;
  document.getElementById("edit-dashboard-modal").classList.add("active");
}
function closeEditDashboardModal() {
  document.getElementById("edit-dashboard-modal").classList.remove("active");
}
function saveDashboardChanges() {
  if (!activeDashboardId) return;
  const newName = document.getElementById("edit-dash-name").value.trim();
  const newBrand = document.getElementById("edit-dash-brand").value.trim();
  const newType = document.getElementById("edit-dash-type").value;
  if (!newName)
    return showInfoModal("Error", "Nama Remote tidak boleh kosong!", "error");
  const index = remoteDashboards.findIndex((d) => d.id === activeDashboardId);
  if (index !== -1) {
    remoteDashboards[index].name = newName;
    remoteDashboards[index].brand = newBrand || "Generic";
    remoteDashboards[index].type = newType;
    saveDashboards();
    document.getElementById("detail-remote-name").innerText = newName;
    document.getElementById("detail-remote-type").innerText =
      `${newBrand} - ${newType.toUpperCase()}`;
    closeEditDashboardModal();
    showInfoModal("Sukses", "Informasi Remote diperbarui.", "success");
  }
}
function openEditButtonModal(btnId) {
  if (!activeDashboardId) return;
  const dash = remoteDashboards.find((d) => d.id === activeDashboardId);
  const btn = dash.buttons.find((b) => b.id == btnId);
  if (!btn) return;
  document.getElementById("edit-btn-id").value = btnId;
  document.getElementById("edit-btn-name").value = btn.name;
  document.getElementById("edit-button-modal").classList.add("active");
}
function closeEditButtonModal() {
  document.getElementById("edit-button-modal").classList.remove("active");
}
function saveButtonChanges() {
  if (!activeDashboardId) return;
  const btnId = document.getElementById("edit-btn-id").value;
  const newName = document.getElementById("edit-btn-name").value.trim();
  if (!newName)
    return showInfoModal("Error", "Nama tombol wajib diisi!", "error");
  const dash = remoteDashboards.find((d) => d.id === activeDashboardId);
  if (!dash) return;
  const btnIndex = dash.buttons.findIndex((b) => b.id == btnId);
  if (btnIndex !== -1) {
    const isDuplicate = dash.buttons.some(
      (b, idx) =>
        b.name.toLowerCase() === newName.toLowerCase() && idx !== btnIndex,
    );
    if (isDuplicate)
      return showInfoModal("Error", "Nama tombol sudah dipakai!", "error");
    dash.buttons[btnIndex].name = newName;
    saveDashboards();
    renderCustomRemotes();
    closeEditButtonModal();
    showInfoModal("Tersimpan", "Nama tombol berhasil diubah.", "success");
  }
}
function deleteCustomButton(btnId) {
  if (!activeDashboardId) return;
  const dash = remoteDashboards.find((d) => d.id === activeDashboardId);
  if (confirm("Hapus tombol ini?")) {
    dash.buttons = dash.buttons.filter((b) => b.id !== btnId);
    saveDashboards();
    renderCustomRemotes();
  }
}
function kirimIR_RAW(btnId) {
  if (!activeDashboardId) return;
  const dash = remoteDashboards.find((d) => d.id === activeDashboardId);
  const btn = dash.buttons.find((b) => b.id == btnId);
  if (btn) {
    kirimIR(btn.hex, btn.code, btn.name);
  } else {
    console.error("Tombol tidak ditemukan di dashboard aktif");
  }
}
function kirimIR(hexCode, rawData, btnName = "Tombol") {
  if (!mqttClient.isConnected()) {
    showInfoModal("Gagal", "MQTT Terputus. Cek koneksi internet.", "error");
    return;
  }
  if (navigator.vibrate) navigator.vibrate(50);
  lastIrSentTime = Date.now();
  const payload = JSON.stringify({ hex: hexCode || "0", raw: rawData || "" });
  const message = new Paho.MQTT.Message(payload);
  message.destinationName = mqtt_topic_ir_send;
  mqttClient.send(message);
  console.log(`📡 Dual IR Sent: ${btnName}`);
  showInfoModal(
    "Terkirim",
    `<div class="text-center">
        <i class="fa-solid fa-satellite-dish text-3xl text-emerald-400 mb-2 animate-pulse"></i><br>
        Perintah <b>"${btnName}"</b><br>
        <span class="text-[10px] text-slate-400">Mode Ganda (Hex + Raw) dikirim</span>
     </div>`,
    "success",
  );
  setTimeout(() => {
    const modal = document.getElementById("global-modal");
    if (modal.classList.contains("active")) {
      closeModalAndReset();
    }
  }, 1500);
}
function deleteCustomButton(id) {
  const targetBtn = customRemotes.find((b) => b.id === id);
  if (!targetBtn) return;
  const mTitle = document.getElementById("modal-title");
  const mMsg = document.getElementById("modal-msg");
  const mIcon = document.getElementById("modal-icon");
  const mBg = document.getElementById("modal-icon-bg");
  const mButtons = document.getElementById("modal-buttons");
  mTitle.innerText = "Hapus Remote?";
  mMsg.innerHTML = `Anda yakin ingin menghapus tombol <b>"${targetBtn.name}"</b>?<br><span class="text-xs text-red-400">Tindakan ini tidak bisa dibatalkan.</span>`;
  mIcon.className = "fa-solid fa-trash-can text-white text-2xl";
  mBg.className =
    "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-red-600 shadow-lg shadow-red-900/50";
  mButtons.innerHTML = `
    <button onclick="closeModalAndReset()" class="flex-1 py-3 rounded-xl bg-slate-700 text-slate-300 font-bold hover:bg-slate-600 transition">Batal</button>
    <button onclick="execDeleteRemote(${id})" class="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-500 transition shadow-lg shadow-red-900/40">Ya, Hapus</button>
  `;
  document.getElementById("global-modal").classList.add("active");
}
function execDeleteRemote(id) {
  customRemotes = customRemotes.filter((b) => b.id !== id);
  localStorage.setItem("myRemotes", JSON.stringify(customRemotes));
  renderCustomRemotes();
  closeModalAndReset();
  if (navigator.vibrate) navigator.vibrate(50);
}
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;
const synthesis = window.speechSynthesis;
let recognition;
let isListening = !1;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = !1;
  recognition.lang = "id-ID";
  recognition.interimResults = !0;
  recognition.onstart = () => {
    isListening = !0;
    document.getElementById("voice-overlay").classList.remove("hidden");
    document.getElementById("mic-icon").className =
      "fa-solid fa-spinner fa-spin text-2xl";
    if (isMusicPlaying) {
      controlMusic("STOP");
      pausedByVoice = !0;
    }
  };
  recognition.onend = () => {
    if (isListening === !1) {
      console.log("Mic berhenti (User Cancel). Icon tetap default.");
      document.getElementById("mic-icon").className =
        "fa-solid fa-microphone text-2xl";
      return;
    }
    document.getElementById("mic-icon").className =
      "fa-solid fa-microphone-lines-slash text-2xl";
    console.log("Mic Standby (Menunggu respon sistem selesai...)");
  };
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.toLowerCase();
    document.getElementById("voice-text-preview").innerText = `"${transcript}"`;
    if (event.results[0].isFinal) {
      console.log("Perintah Suara:", transcript);
      if (
        transcript.includes("oke google") ||
        transcript.includes("oke sistem") ||
        transcript.includes("ok sistem") ||
        transcript.includes("ok google")
      ) {
        console.log("🔔 Wake Word Terdeteksi!");
        bicara("Iya tuan. Silakan katakan perintah Anda.");
        return;
      }
      prosesPerintahSuara(transcript);
    }
  };
} else {
  alert("Browser Anda tidak mendukung Voice Command (Gunakan Chrome).");
}
function toggleVoiceCommand() {
  if (isListening) stopVoiceCommand();
  else recognition.start();
}
function stopVoiceCommand() {
  console.log("⛔ Menghentikan Voice Command...");
  isListening = !1;
  if (recognition) {
    try {
      recognition.stop();
      recognition.abort();
    } catch (e) {}
  }
  if (synthesis.speaking) {
    synthesis.cancel();
  }
  document.getElementById("voice-overlay").classList.add("hidden");
  const micIcon = document.getElementById("mic-icon");
  if (micIcon) {
    micIcon.className = "fa-solid fa-microphone text-2xl";
  }
  if (pausedByVoice) {
    controlMusic("PLAY");
    pausedByVoice = !1;
  }
}
const ELEVENLABS_API_KEY =
  "sk_0952f72a48941acbf2b903eb8e13081547aae3f357171aaa";
const ELEVENLABS_VOICE_ID = "X8n8hOy3e8VLQnHTUcc5";
function bicara(teks, stopListening = !1, callback = null) {
  if (synthesis.speaking) synthesis.cancel();
  console.log("🤖 Memproses suara AI...");
  const preview = document.getElementById("voice-text-preview");
  if (preview) preview.innerText = "Memuat suara AI...";
  fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
    method: "POST",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: teks,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.8 },
    }),
  })
    .then((response) => {
      if (!response.ok) throw new Error("Gagal/Kuota Habis");
      return response.blob();
    })
    .then((blob) => {
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audio.play();
      audio.onended = function () {
        selesaiBicara(stopListening, callback);
      };
    })
    .catch((error) => {
      console.warn("⚠️ ElevenLabs Error (Pakai Robot):", error);
      bicaraRobot(teks, stopListening, callback);
    });
}
function bicaraRobot(teks, stopListening, callback = null) {
  const ucapan = new SpeechSynthesisUtterance(teks);
  ucapan.lang = "id-ID";
  ucapan.rate = 1;
  ucapan.pitch = 1;
  ucapan.onend = function () {
    selesaiBicara(stopListening, callback);
  };
  synthesis.speak(ucapan);
}
function selesaiBicara(stopListening, callback) {
  if (callback && typeof callback === "function") {
    console.log("✅ Menjalankan aksi setelah bicara...");
    callback();
  }
  if (stopListening) {
    stopVoiceCommand();
  } else {
    if (isListening === !1) return;
    try {
      const preview = document.getElementById("voice-text-preview");
      if (preview) preview.innerText = "Mendengarkan lagi...";
      recognition.start();
    } catch (e) {}
  }
}
function prosesPerintahSuara(teks) {
  console.log("Mendeteksi suara:", teks);
  if (
    teks.includes("terima kasih") ||
    teks.includes("makasih") ||
    teks.includes("cukup") ||
    teks.includes("sudah")
  ) {
    bicara(
      "Sama-sama tuan. Senang bisa membantu Anda. Voice Command ditutup.",
      !0,
    );
    return;
  } else if (
    teks.includes("keluar aplikasi") ||
    teks.includes("tutup aplikasi") ||
    teks.includes("keluar dari dashboard") ||
    teks.includes("exit")
  ) {
    bicara("Baik tuan. Menutup aplikasi. Sampai jumpa.", !0, () => {
      console.log("🚪 Menutup window sekarang.");
      window.close();
      showInfoModal(
        "Info",
        "Silakan tekan tombol Home atau Back pada HP untuk keluar.",
        "info",
      );
    });
    return;
  } else if (
    teks.includes("mainkan musik") ||
    teks.includes("putar musik") ||
    teks.includes("nyalakan lagu") ||
    teks.includes("nyalakan musik")
  ) {
    bicara("Baik tuan, memutar musik sekarang.", !0, () => {
      pausedByVoice = !1;
      controlMusic("PLAY");
      console.log("🎵 Musik dinyalakan via Voice (Sync)");
    });
  } else if (
    teks.includes("matikan musik") ||
    teks.includes("stop musik") ||
    teks.includes("berhenti lagu")
  ) {
    controlMusic("STOP");
    pausedByVoice = !1;
    bicara("Musik dihentikan secara permanen.", !0);
  } else if (
    teks.includes("ganti lagu") ||
    teks.includes("ganti musik") ||
    teks.includes("lagu selanjutnya")
  ) {
    if (player && typeof player.nextVideo === "function") {
      player.nextVideo();
      pausedByVoice = !1;
      isMusicPlaying = !0;
      bicara("Memutar lagu selanjutnya.", !0);
    } else {
      bicara("Maaf, player belum siap.", !0);
    }
  } else if (
    teks.includes("tambah kartu") ||
    teks.includes("registrasi kartu") ||
    teks.includes("daftar kartu")
  ) {
    openRfidModal();
    bicara("Membuka menu registrasi kartu RFID. Silakan tempel kartu.", !0);
  } else if (
    teks.includes("cek kartu") ||
    teks.includes("info kartu") ||
    teks.includes("siapa saja yang terdaftar")
  ) {
    bicara("Sedang mengambil data database, mohon tunggu sebentar...");
    fetch(GAS_URL)
      .then((res) => res.json())
      .then((data) => {
        if (!data || data.length === 0) {
          bicara("Database kosong. Belum ada kartu terdaftar.", !0);
          return;
        }
        const total = data.length;
        let spokenNames = "";
        if (total <= 5) {
          spokenNames = data.map((u) => u.name).join(", ");
        } else {
          const firstFive = data
            .map((u) => u.name)
            .slice(0, 5)
            .join(", ");
          spokenNames = `${firstFive}, dan ${total - 5} orang lainnya`;
        }
        let htmlList = `<div class="bg-slate-900/50 p-2 rounded-lg mb-2 text-xs text-slate-400">Total: ${total} Kartu</div>`;
        htmlList += `<ul class="text-left space-y-2 max-h-60 overflow-y-auto pr-1">`;
        data.forEach((u) => {
          htmlList += `
            <li class="bg-slate-700 p-3 rounded-lg flex justify-between items-center border border-slate-600">
                <div class="flex items-center gap-2">
                    <i class="fa-solid fa-id-card text-emerald-500"></i>
                    <span class="font-bold text-white text-sm">${u.name}</span>
                </div>
                <span class="font-mono text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">${u.uid}</span>
            </li>`;
        });
        htmlList += `</ul>`;
        showInfoModal("Database RFID", htmlList, "info");
        bicara(
          `Ditemukan ${total} kartu terdaftar. Pemiliknya adalah: ${spokenNames}.`,
          !0,
        );
      })
      .catch((e) => {
        console.error("Error Fetch RFID:", e);
        bicara("Maaf, gagal mengambil data dari server.", !0);
      });
  } else if (
    teks.includes("status kipas") ||
    teks.includes("cek kipas") ||
    teks.includes("info kipas")
  ) {
    let statusMsg = "";
    if (currentFanSpeed <= 0) {
      statusMsg = "Kipas saat ini dalam kondisi mati.";
    } else {
      statusMsg = `Kipas menyala pada kecepatan ${currentFanSpeed}.`;
    }
    bicara(statusMsg, !0);
  } else if (
    teks.includes("status kunci") ||
    teks.includes("cek kunci") ||
    teks.includes("kondisi kunci")
  ) {
    let statusMsg = isDoorLocked
      ? "Pintu saat ini TERKUNCI aman."
      : "Kunci saat ini dalam kondisi TERBUKA.";
    bicara(statusMsg, !0);
  } else if (
    teks.includes("status sensor") ||
    teks.includes("cek sensor") ||
    teks.includes("laporan sistem")
  ) {
    const laser = document.getElementById("toggle-laser").checked
      ? "Aktif"
      : "Mati";
    const ir = document.getElementById("toggle-ir").checked ? "Aktif" : "Mati";
    const hc = document.getElementById("toggle-hc").checked ? "Aktif" : "Mati";
    const api = document.getElementById("toggle-api").checked
      ? "Aktif"
      : "Mati";
    bicara(
      `Laporan status sensor: Laser ${laser}, Sensor Gerak ${ir}, Sensor Jarak ${hc}, dan Detektor Api ${api}.`,
      !0,
    );
  } else if (
    teks.includes("buka pintu") ||
    teks.includes("kunci pintu dibuka")
  ) {
    controlDoor("UNLOCK", !0);
    bicara("Baik, pintu berhasil dibuka selama 10 detik.", !0);
  } else if (teks.includes("kunci pintu") || teks.includes("tutup pintu")) {
    controlDoor("LOCK", !0);
    bicara("Pintu telah dikunci kembali.", !0);
  } else if (teks.includes("kipas 1") || teks.includes("kecepatan 1")) {
    controlFan(1, !0);
    bicara("Menyalakan kipas kecepatan satu.", !0);
  } else if (teks.includes("kipas 2") || teks.includes("kecepatan 2")) {
    controlFan(2, !0);
    bicara("Menyalakan kipas kecepatan dua.", !0);
  } else if (teks.includes("kipas 3") || teks.includes("maksimal")) {
    controlFan(3, !0);
    bicara("Kipas diset ke kecepatan maksimal.", !0);
  } else if (teks.includes("matikan kipas") || teks.includes("kipas mati")) {
    controlFan(0, !0);
    bicara("Kipas dimatikan.", !0);
  } else if (
    teks.includes("nyalakan laser") ||
    teks.includes("aktifkan keamanan")
  ) {
    toggleSecurity("laser", !0, !0);
    bicara("Sistem keamanan laser diaktifkan.", !0);
  } else if (
    teks.includes("matikan laser") ||
    teks.includes("matikan keamanan")
  ) {
    toggleSecurity("laser", !1, !0);
    bicara("Sistem keamanan laser dinonaktifkan.", !0);
  } else if (teks.includes("hidupkan sensor gerak")) {
    toggleSecurity("ir", !0, !0);
    bicara("Sensor gerak aktif.", !0);
  } else if (teks.includes("matikan sensor gerak")) {
    toggleSecurity("ir", !1, !0);
    bicara("Sensor gerak mati.", !0);
  } else if (teks.includes("hidupkan sensor jarak")) {
    toggleSecurity("hc", !0, !0);
    bicara("Sensor jarak aktif.", !0);
  } else if (teks.includes("matikan sensor jarak")) {
    toggleSecurity("hc", !1, !0);
    bicara("Sensor jarak mati.", !0);
  } else if (teks.includes("hidupkan sensor api")) {
    toggleSecurity("api", !0, !0);
    bicara("Detektor api aktif.", !0);
  } else if (teks.includes("matikan sensor api")) {
    toggleSecurity("api", !1, !0);
    bicara("Detektor api mati.", !0);
  } else if (teks.includes("suhu ruangan") || teks.includes("cek suhu")) {
    const temp = document.getElementById("temp2").innerText;
    const hum = document.getElementById("hum2").innerText;
    bicara(
      `Suhu ruangan saat ini ${temp} derajat celcius, kelembaban ${hum} persen.`,
      !0,
    );
  } else if (teks.includes("cek cuaca") || teks.includes("info cuaca")) {
    const lokasi = document.getElementById("locName").innerText;
    const deskripsi = document.getElementById("mainDesc").innerText;
    bicara(`Cuaca di ${lokasi} saat ini ${deskripsi}.`, !0);
  } else {
    bicara("Maaf, perintah tidak dikenali. Silakan ulangi.", !1);
  }
}
let currentPin = "";
const savedPin = "121232";
window.addEventListener("DOMContentLoaded", () => {
  const title = document.getElementById("lock-title");
  const msg = document.getElementById("lock-msg");
  if (title) title.innerText = "LOCKED";
  if (msg) msg.innerText = "Ketuk layar untuk Scan Sidik Jari";
  if (window.PublicKeyCredential) {
    PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(
      (available) => {
        if (available) {
          console.log("Biometrik tersedia.");
          let hasTriggeredAuth = !1;
          const safeTrigger = () => {
            if (hasTriggeredAuth) return;
            hasTriggeredAuth = !0;
            console.log("Memicu Biometrik...");
            verifyBiometric().catch(() => {
              setTimeout(() => {
                hasTriggeredAuth = !1;
              }, 2000);
            });
          };
          setTimeout(() => {
            if (document.visibilityState === "visible") {
              safeTrigger();
            }
          }, 1500);
          document.addEventListener("click", () => {
            safeTrigger();
          });
        }
      },
    );
  }
});
function inputPin(num) {
  if (currentPin.length < 6) {
    currentPin += num;
    updatePinDots();
    if (navigator.vibrate) navigator.vibrate(30);
    if (currentPin.length === 6) {
      setTimeout(checkPin, 200);
    }
  }
}
function deletePin() {
  currentPin = currentPin.slice(0, -1);
  updatePinDots();
}
function updatePinDots() {
  const dots = document.querySelectorAll(".pin-dot");
  dots.forEach((dot, index) => {
    if (index < currentPin.length) {
      dot.classList.add("pin-filled");
    } else {
      dot.classList.remove("pin-filled");
    }
  });
}
function checkPin() {
  if (currentPin === savedPin) {
    unlockApp();
  } else {
    handleError();
  }
}
function unlockApp() {
  const lockScreen = document.getElementById("lock-screen");
  const lockTitle = document.getElementById("lock-title");
  const lockMsg = document.getElementById("lock-msg");
  if (lockTitle) {
    lockTitle.innerText = "DITERIMA";
    lockTitle.classList.add("text-emerald-500");
  }
  if (lockMsg) {
    lockMsg.innerText = "Membuka Dashboard...";
  }
  if (navigator.vibrate) navigator.vibrate([50, 50, 200]);
  if (lockScreen) {
    lockScreen.style.transform = "translateY(-100%)";
  }
}
function handleError() {
  const lockScreen = document.getElementById("lock-screen");
  const lockTitle = document.getElementById("lock-title");
  const lockMsg = document.getElementById("lock-msg");
  if (lockTitle) {
    lockTitle.innerText = "SALAH!";
    lockTitle.classList.add("text-red-500");
  }
  if (lockMsg) {
    lockMsg.innerText = "PIN tidak cocok.";
  }
  if (navigator.vibrate) navigator.vibrate([50, 100, 50, 100]);
  if (lockScreen) lockScreen.classList.add("shake-lock");
  setTimeout(() => {
    if (lockScreen) lockScreen.classList.remove("shake-lock");
    currentPin = "";
    updatePinDots();
    if (lockTitle) {
      lockTitle.innerText = "LOCKED";
      lockTitle.classList.remove("text-red-500");
    }
    if (lockMsg) {
      lockMsg.innerText = "Coba lagi atau gunakan Sidik Jari.";
    }
  }, 600);
}
async function verifyBiometric() {
  if (!window.PublicKeyCredential) {
    console.warn("Browser ini tidak mendukung fitur biometrik.");
    return;
  }
  try {
    const available =
      await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!available) return;
  } catch (e) {
    console.error(e);
    return;
  }
  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);
    const publicKeyCredentialCreationOptions = {
      publicKey: {
        challenge: challenge,
        rp: { name: "IoT Dashboard Login", id: window.location.hostname },
        user: {
          id: new Uint8Array(16),
          name: "admin@iot",
          displayName: "Admin Dashboard",
        },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          requireResidentKey: !1,
        },
        timeout: 60000,
        attestation: "none",
      },
    };
    console.log("Meminta akses biometrik...");
    await navigator.credentials.create(publicKeyCredentialCreationOptions);
    console.log("Biometrik Sukses!");
    unlockApp();
  } catch (err) {
    console.error("Biometrik Gagal/Dibatalkan:", err);
    if (err.name === "NotAllowedError" || err.name === "AbortError") {
      handleError();
    } else {
      console.log("Silent error pada floating window (aman untuk diabaikan).");
    }
  }
}
document.addEventListener("keydown", (e) => {
  const lockScreen = document.getElementById("lock-screen");
  if (lockScreen && lockScreen.style.transform !== "translateY(-100%)") {
    if (e.key >= "0" && e.key <= "9") {
      inputPin(parseInt(e.key));
    } else if (e.key === "Backspace") {
      deletePin();
    } else if (e.key === "Enter") {
    }
  }
});
const bgCanvasEl = document.getElementById("bg-canvas");
if (bgCanvasEl) {
  const bgCtx = bgCanvasEl.getContext("2d");
  let width, height;
  let particles = [];
  let matrixDrops = [];
  const phrases = [
    "SYSTEM_BREACH\nDETECTED\n[CRITICAL]",
    "INITIALIZING\nROOT_ACCESS\nVERSI 15.4 PRO",
    "DECRYPTING\nSECURE_FILES\nPLEASE_WAIT...",
    "UPLOAD_VIRUS:\nCOMPLETE\n100%",
    "BYPASSING\nFIREWALL\nSECURITY_LAYER",
    "CONNECTION\nESTABLISHED\nSERVER_2026",
    "ACCESS_GRANTED\nADMIN_RIYAN\nWELCOME",
    "DOWNLOADING\nDATABASE\nJOBS_DONE...",
  ];
  let currentPhraseIndex = 0;
  const autoScanner = { x: 0, y: 0, vx: 4, vy: 3, radius: 100 };
  let animState = "scattered";
  let stateTimer = 0;
  function resize() {
    width = bgCanvasEl.width = window.innerWidth;
    height = bgCanvasEl.height = window.innerHeight;
    autoScanner.x = width / 2;
    autoScanner.y = height / 2;
    initMatrix();
    createParticles();
  }
  window.addEventListener("resize", resize);
  class Particle {
    constructor() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.targetX = this.x;
      this.targetY = this.y;
      this.vx = (Math.random() - 0.5) * 2;
      this.vy = (Math.random() - 0.5) * 2;
      this.size = Math.random() * 2 + 1;
      this.char = this.getRandomChar();
      this.active = !1;
    }
    getRandomChar() {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$#@%&";
      return chars.charAt(Math.floor(Math.random() * chars.length));
    }
    update() {
      let dx = autoScanner.x - this.x;
      let dy = autoScanner.y - this.y;
      let dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < autoScanner.radius) {
        const force = (autoScanner.radius - dist) / autoScanner.radius;
        const angle = Math.atan2(dy, dx);
        const push = 20 * force;
        this.x -= Math.cos(angle) * push;
        this.y -= Math.sin(angle) * push;
      }
      if (
        animState === "forming" ||
        animState === "holding" ||
        animState === "dispersing"
      ) {
        if (this.active || animState === "dispersing") {
          this.x += (this.targetX - this.x) * 0.15;
          this.y += (this.targetY - this.y) * 0.15;
          this.x += (Math.random() - 0.5) * 0.5;
          this.y += (Math.random() - 0.5) * 0.5;
        } else {
          this.x += this.vx;
          this.y += this.vy;
          this.boundaryCheck();
        }
      } else {
        this.x += this.vx;
        this.y += this.vy;
        this.boundaryCheck();
      }
    }
    boundaryCheck() {
      if (this.x < 0) this.x = width;
      else if (this.x > width) this.x = 0;
      if (this.y < 0) this.y = height;
      else if (this.y > height) this.y = 0;
    }
    draw() {
      bgCtx.font = "bold " + this.size + "px monospace";
      if (this.active && (animState === "forming" || animState === "holding")) {
        const rand = Math.random();
        if (rand > 0.95) bgCtx.fillStyle = "#fff";
        else if (rand > 0.9) bgCtx.fillStyle = "#0ff";
        else bgCtx.fillStyle = "#0f0";
        bgCtx.shadowBlur = 8;
        bgCtx.shadowColor = bgCtx.fillStyle;
      } else {
        bgCtx.fillStyle = "rgba(0, 255, 0, 0.15)";
        bgCtx.shadowBlur = 0;
      }
      if (Math.random() > 0.9) this.char = this.getRandomChar();
      bgCtx.fillText(this.char, this.x, this.y);
    }
  }
  class MatrixDrop {
    constructor(x) {
      this.x = x;
      this.y = Math.random() * -height;
      this.speed = Math.random() * 5 + 2;
    }
    update() {
      this.y += this.speed;
      if (this.y > height) {
        this.y = Math.random() * -200;
        this.speed = Math.random() * 5 + 2;
      }
    }
    draw() {
      bgCtx.fillStyle = "rgba(0, 50, 0, 0.3)";
      bgCtx.font = "12px monospace";
      const char = String.fromCharCode(0x30a0 + Math.random() * 96);
      bgCtx.fillText(char, this.x, this.y);
    }
  }
  function initMatrix() {
    matrixDrops = [];
    const columns = width / 10;
    for (let i = 0; i < columns; i++) matrixDrops.push(new MatrixDrop(i * 10));
  }
  function getTextCoordinates(text) {
    const offCanvas = document.createElement("canvas");
    const offCtx = offCanvas.getContext("2d");
    offCanvas.width = width;
    offCanvas.height = height;
    const lines = text.split("\n");
    let longestLine = lines.reduce((a, b) => (a.length > b.length ? a : b), "");
    let calculatedSize = Math.floor((width / longestLine.length) * 1.3);
    const maxFontSize = 80;
    const minFontSize = 20;
    if (calculatedSize > maxFontSize) calculatedSize = maxFontSize;
    if (calculatedSize < minFontSize) calculatedSize = minFontSize;
    offCtx.font = "bold " + calculatedSize + "px monospace";
    offCtx.fillStyle = "white";
    offCtx.textAlign = "center";
    offCtx.textBaseline = "middle";
    const lineHeight = calculatedSize * 1.1;
    const totalHeight = lines.length * lineHeight;
    let startY = height / 2 - totalHeight / 2 + lineHeight / 2;
    if (width < 600) startY -= 80;
    lines.forEach((line, index) => {
      offCtx.fillText(line, width / 2, startY + index * lineHeight);
    });
    const imageData = offCtx.getImageData(0, 0, width, height).data;
    const coords = [];
    const isMobile = width < 600;
    const gap = isMobile ? 3 : 2;
    for (let y = 0; y < height; y += gap) {
      for (let x = 0; x < width; x += gap) {
        const alpha = imageData[(y * width + x) * 4 + 3];
        if (alpha > 128) coords.push({ x, y });
      }
    }
    return coords;
  }
  function createParticles() {
    particles = [];
    const count = width < 600 ? 1200 : 2500;
    for (let i = 0; i < count; i++) particles.push(new Particle());
  }
  function setTargetShape(text) {
    const coords = getTextCoordinates(text);
    particles.forEach((p) => (p.active = !1));
    for (let i = particles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [particles[i], particles[j]] = [particles[j], particles[i]];
    }
    for (let i = 0; i < coords.length; i++) {
      if (i < particles.length) {
        particles[i].targetX = coords[i].x;
        particles[i].targetY = coords[i].y;
        particles[i].active = !0;
      }
    }
  }
  function animate() {
    if (!isBackgroundAnimationRunning) {
      requestAnimationFrame(animate);
      return;
    }
    bgCtx.fillStyle = "rgba(0, 0, 0, 0.85)";
    bgCtx.fillRect(0, 0, width, height);
    autoScanner.x += autoScanner.vx;
    autoScanner.y += autoScanner.vy;
    if (autoScanner.x <= 0 || autoScanner.x >= width) autoScanner.vx *= -1;
    if (autoScanner.y <= 0 || autoScanner.y >= height) autoScanner.vy *= -1;
    matrixDrops.forEach((drop) => {
      drop.update();
      drop.draw();
    });
    particles.forEach((p) => {
      p.update();
      p.draw();
    });
    stateTimer++;
    if (animState === "scattered") {
      if (stateTimer > 40) {
        animState = "forming";
        setTargetShape(phrases[currentPhraseIndex]);
        currentPhraseIndex = (currentPhraseIndex + 1) % phrases.length;
        stateTimer = 0;
      }
    } else if (animState === "forming") {
      if (stateTimer > 80) {
        animState = "holding";
        stateTimer = 0;
      }
    } else if (animState === "holding") {
      if (stateTimer > 180) {
        animState = "dispersing";
        stateTimer = 0;
        particles.forEach((p) => {
          p.targetX = Math.random() * width;
          p.targetY = Math.random() * height;
          p.active = !0;
        });
      }
    } else if (animState === "dispersing") {
      if (stateTimer > 60) {
        animState = "scattered";
        stateTimer = 0;
        particles.forEach((p) => {
          p.active = !1;
          p.vx = (Math.random() - 0.5) * 2;
          p.vy = (Math.random() - 0.5) * 2;
        });
      }
    }
    requestAnimationFrame(animate);
  }
  resize();
  animate();
}
let historyPushed = !1;
function initHistoryGuard() {
  if (!historyPushed) {
    window.history.pushState({ page: "guard" }, "", window.location.href);
    historyPushed = !0;
  }
}
document.addEventListener("click", initHistoryGuard, { once: !0 });
document.addEventListener("touchstart", initHistoryGuard, { once: !0 });
document.addEventListener("scroll", initHistoryGuard, { once: !0 });
window.onpopstate = function (event) {
  window.history.pushState({ page: "guard" }, "", window.location.href);
  const homeSection = document.getElementById("page-home");
  const isHome = homeSection && homeSection.classList.contains("active-page");
  const globalModal = document.getElementById("global-modal");
  const isExitModalOpen =
    globalModal.classList.contains("active") &&
    document.getElementById("modal-title").innerText === "Keluar Aplikasi?";
  const activeModals = document.querySelectorAll(".modal-overlay.active");
  if (isExitModalOpen) {
    closeModalAndReset();
  } else if (activeModals.length > 0) {
    activeModals.forEach((modal) => modal.classList.remove("active"));
    if (typeof resetToCamera === "function") resetToCamera();
  } else if (!isHome) {
    switchPage("page-home");
  } else {
    showExitConfirmation();
  }
};
function showExitConfirmation() {
  const mTitle = document.getElementById("modal-title");
  const mMsg = document.getElementById("modal-msg");
  const mIcon = document.getElementById("modal-icon");
  const mBg = document.getElementById("modal-icon-bg");
  const mButtons = document.getElementById("modal-buttons");
  const modal = document.getElementById("global-modal");
  mTitle.innerText = "Keluar Aplikasi?";
  mMsg.innerHTML = "Apakah Anda yakin ingin menutup Dashboard IoT?";
  mIcon.className = "fa-solid fa-power-off text-white text-2xl";
  mBg.className =
    "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.8)]";
  mButtons.innerHTML = `
        <button onclick="closeModalAndReset()" class="flex-1 py-3 rounded-lg bg-slate-700 text-white font-bold hover:bg-slate-600 transition">
            Batal
        </button>
        <button onclick="forceExitApp()" class="flex-1 py-3 rounded-lg bg-red-600 text-white font-bold hover:bg-red-500 transition shadow-lg shadow-red-900/40">
            Ya, Keluar
        </button>
    `;
  modal.classList.add("active");
}
function forceExitApp() {
  // 1. Coba tutup pakai perintah Native (Jika pakai Cordova/Hybrid)
  if (navigator.app && navigator.app.exitApp) {
    navigator.app.exitApp();
    return;
  }
  if (navigator.device && navigator.device.exitApp) {
    navigator.device.exitApp();
    return;
  }

  // 2. Coba tutup pakai standar JS
  window.close();
  try {
    window.top.close();
  } catch (e) {}

  // 3. JIKA GAGAL TUTUP (Karena PWA/Browser Security):
  // Hapus listener back button agar user bisa keluar manual dengan menekan back sekali lagi
  window.onpopstate = null;

  // Tutup modal konfirmasi yang sekarang terbuka
  const globalModal = document.getElementById("global-modal");
  if (globalModal) globalModal.classList.remove("active");

  // Tampilkan pesan instruksi (Persis seperti Voice Command)
  showInfoModal(
    "Info Keluar",
    "Browser mencegah aplikasi tertutup otomatis.<br><b>Silakan tekan tombol HOME atau SWIPE di HP Anda untuk keluar.</b>",
    "info",
  );

  // Opsional: Mundur history browser untuk membatalkan 'guard'
  // Ini memungkinkan tombol back fisik berfungsi normal setelah pesan muncul
  setTimeout(() => {
    history.go(-2);
  }, 500);
}
