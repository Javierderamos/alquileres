// Caché para uso sin conexión en el gimnasio
const CACHE = "retorno-fuerza-v3";
const FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "img/Butt_Lift_Bridge_0.jpg",
  "img/Butt_Lift_Bridge_1.jpg",
  "img/Dead_Bug_0.jpg",
  "img/Dead_Bug_1.jpg",
  "img/Dumbbell_Bicep_Curl_0.jpg",
  "img/Dumbbell_Bicep_Curl_1.jpg",
  "img/Dumbbell_Squat_To_A_Bench_0.jpg",
  "img/Dumbbell_Squat_To_A_Bench_1.jpg",
  "img/Incline_Dumbbell_Press_0.jpg",
  "img/Incline_Dumbbell_Press_1.jpg",
  "img/Incline_Push-Up_0.jpg",
  "img/Incline_Push-Up_1.jpg",
  "img/Leg_Extensions_0.jpg",
  "img/Leg_Extensions_1.jpg",
  "img/Leg_Press_0.jpg",
  "img/Leg_Press_1.jpg",
  "img/Leverage_Chest_Press_0.jpg",
  "img/Leverage_Chest_Press_1.jpg",
  "img/Lying_Dumbbell_Tricep_Extension_0.jpg",
  "img/Lying_Dumbbell_Tricep_Extension_1.jpg",
  "img/One-Arm_Dumbbell_Row_0.jpg",
  "img/One-Arm_Dumbbell_Row_1.jpg",
  "img/Seated_Cable_Rows_0.jpg",
  "img/Seated_Cable_Rows_1.jpg",
  "img/Seated_Leg_Curl_0.jpg",
  "img/Seated_Leg_Curl_1.jpg",
  "img/Standing_Biceps_Cable_Curl_0.jpg",
  "img/Standing_Biceps_Cable_Curl_1.jpg",
  "img/Standing_Calf_Raises_0.jpg",
  "img/Standing_Calf_Raises_1.jpg",
  "img/Stiff-Legged_Dumbbell_Deadlift_0.jpg",
  "img/Stiff-Legged_Dumbbell_Deadlift_1.jpg",
  "img/Triceps_Pushdown_-_Rope_Attachment_0.jpg",
  "img/Triceps_Pushdown_-_Rope_Attachment_1.jpg",
  "img/Wide-Grip_Lat_Pulldown_0.jpg",
  "img/Wide-Grip_Lat_Pulldown_1.jpg",
  "img/ref/ref-comparar.jpg",
  "img/ref/ref-progresar.jpg",
  "img/ref/ref-tren-inferior.jpg",
  "img/ref/ref-tren-superior.jpg"
];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => {
    if (res.ok && new URL(e.request.url).origin === location.origin) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match("index.html"))));
});
