// 🔥 Replace with your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBO3h_iI7SHhZFytdHc3nKhddlxAPKwRIs",
  authDomain: "grow-a-garden-dfdab.firebaseapp.com",
  databaseURL: "https://grow-a-garden-dfdab-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "grow-a-garden-dfdab",
  storageBucket: "grow-a-garden-dfdab.firebasestorage.app",
  messagingSenderId: "868567449799",
  appId: "1:868567449799:web:b7e28d1e2ff9c7ce53bee2"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

let serverId = null;
let currentSlot = null;
let playerName = "";
let timers = {};
let liveCrops = {};

const MAX_PLAYERS = 6;
const PLOTS_PER_PLAYER = 10;

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("login-btn").onclick = login;
  document.getElementById("register-btn").onclick = register;
  document.getElementById("logout-btn").onclick = logout;
  document.getElementById("buy-seed-btn").onclick = buySeed;

  auth.onAuthStateChanged(user => {
    if (user) joinOrCreateServer(user.uid, user.email);
  });

  setInterval(updateTimers, 1000);
});

function login() {
  const email = document.getElementById("email-input").value;
  const pass = document.getElementById("password-input").value;
  auth.signInWithEmailAndPassword(email, pass).catch(err => {
    document.getElementById("login-msg").innerText = err.message;
  });
}

function register() {
  const email = document.getElementById("email-input").value;
  const pass = document.getElementById("password-input").value;
  auth.createUserWithEmailAndPassword(email, pass)
    .then(cred => {
      const uid = cred.user.uid;
      db.ref("users/" + uid).set({ seeds: 1, coins: 0 }).then(() => {
        joinOrCreateServer(uid, email);
      });
    })
    .catch(err => {
      document.getElementById("login-msg").innerText = err.message;
    });
}

function logout() {
  if (serverId && currentSlot) {
    db.ref(`servers/${serverId}/slot${currentSlot}`).remove().then(() => {
      auth.signOut();
    });
  } else {
    auth.signOut();
  }
}

function joinOrCreateServer(uid, email) {
  db.ref("servers").once("value").then(snapshot => {
    const servers = snapshot.val() || {};

    for (const sid in servers) {
      for (let i = 1; i <= MAX_PLAYERS; i++) {
        const slot = servers[sid]["slot" + i];
        if (slot && slot.uid === uid) {
          serverId = sid;
          currentSlot = i;
          playerName = slot.name || email.split("@")[0];
          setupGame();
          return;
        }
      }
    }

    for (const sid in servers) {
      for (let i = 1; i <= MAX_PLAYERS; i++) {
        if (!servers[sid]["slot" + i]) {
          assignSlot(sid, i, uid, email);
          return;
        }
      }
    }

    const newRef = db.ref("servers").push();
    assignSlot(newRef.key, 1, uid, email);
  });
}

function assignSlot(sid, i, uid, email) {
  serverId = sid;
  currentSlot = i;
  playerName = email.split("@")[0];
  db.ref(`servers/${sid}/slot${i}`).set({
    uid,
    name: playerName
  }).then(setupGame);
}

function setupGame() {
  document.getElementById("login-container").style.display = "none";
  document.getElementById("logout-btn").style.display = "inline-block";
  document.getElementById("shop").style.display = "block";
  document.getElementById("garden-container").style.display = "grid";

  loadUserData();
  renderAllSlots();
}

function loadUserData() {
  const uid = auth.currentUser.uid;
  const ref = db.ref("users/" + uid);

  ref.on("value", snap => {
    const data = snap.val() || {};
    const seeds = typeof data.seeds === 'number' ? data.seeds : 0;
    const coins = typeof data.coins === 'number' ? data.coins : 0;

    document.getElementById("shop-seeds").innerText = seeds;
    document.getElementById("shop-coins").innerText = coins;

    if (!('seeds' in data)) ref.child("seeds").set(1);
    if (!('coins' in data)) ref.child("coins").set(0);
  });
}

function renderAllSlots() {
  const container = document.getElementById("garden-container");
  container.innerHTML = "";

  for (let s = 1; s <= MAX_PLAYERS; s++) {
    const section = document.createElement("div");
    section.className = "player-section";
    section.innerHTML = `<div class="player-name" id="player-name-${s}">Loading...</div><div class="grid" id="grid-${s}"></div>`;
    container.appendChild(section);
    renderPlots(s);
  }

  db.ref(`servers/${serverId}`).on("value", snapshot => {
    const data = snapshot.val();
    for (let s = 1; s <= MAX_PLAYERS; s++) {
      const player = data && data["slot" + s];
      document.getElementById("player-name-" + s).innerText = player ? player.name : "Empty";
    }
  });
}

function renderPlots(slot) {
  const grid = document.getElementById("grid-" + slot);
  if (!grid) return;

  for (let i = 0; i < PLOTS_PER_PLAYER; i++) {
    const div = document.createElement("div");
    div.className = "plot";
    div.id = `plot-${slot}-${i}`;
    div.innerHTML = `<div class="timer-text" id="timer-${slot}-${i}"></div>`;
    div.onclick = () => handlePlotClick(slot, i);
    grid.appendChild(div);
  }

  db.ref(`servers/${serverId}/slot${slot}/crops`).on("value", snap => {
    const data = snap.val() || {};
    for (let i = 0; i < PLOTS_PER_PLAYER; i++) {
      liveCrops[`${slot}-${i}`] = data[i] || null;
      updatePlot(slot, i, data[i]);
    }
  });
}

function handlePlotClick(slot, i) {
  if (slot != currentSlot) return;

  const uid = auth.currentUser.uid;
  db.ref(`servers/${serverId}/slot${slot}/crops/${i}`).once("value").then(snap => {
    const crop = snap.val();
    if (!crop) {
      db.ref(`users/${uid}`).once("value").then(userSnap => {
        const user = userSnap.val();
        if ((user?.seeds || 0) > 0) {
          const plantedAt = Date.now();
          db.ref(`servers/${serverId}/slot${slot}/crops/${i}`).set({ plantedAt });
          db.ref(`users/${uid}/seeds`).set(user.seeds - 1);
        }
      });
    } else {
      const elapsed = Date.now() - Number(crop.plantedAt);
      if (elapsed >= 9000) {
        db.ref(`servers/${serverId}/slot${slot}/crops/${i}`).remove();
        db.ref(`users/${uid}/seeds`).transaction(n => (n || 0) + 1);
        db.ref(`users/${uid}/coins`).transaction(n => (n || 0) + 3);
      }
    }
  });
}

function updatePlot(slot, i, data) {
  const plot = document.getElementById(`plot-${slot}-${i}`);
  const timerText = document.getElementById(`timer-${slot}-${i}`);
  if (!plot || !timerText) return;

  plot.className = "plot";
  timerText.innerText = "";

  if (!data || !data.plantedAt) {
    clearTimer(slot, i);
    return;
  }

  const plantedAt = Number(data.plantedAt);
  const now = Date.now();
  const elapsed = now - plantedAt;

  const isReady = elapsed >= 9000;
  const isGrowing = elapsed >= 3000 && elapsed < 9000;

  if (isReady) {
    plot.classList.add("ready");
  } else if (isGrowing) {
    plot.classList.add("growing");
  } else {
    plot.classList.add("planted");
  }

  showTimer(slot, i, plantedAt, isReady ? 0 : isGrowing ? 9 : 3);
}

function showTimer(slot, i, plantedAt, totalSeconds) {
  clearTimer(slot, i);
  function tick() {
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((plantedAt + totalSeconds * 1000 - now) / 1000));
    const timerText = document.getElementById(`timer-${slot}-${i}`);
    if (timerText) timerText.innerText = remaining > 0 ? remaining + "s" : "";
  }
  tick();
  timers[`${slot}-${i}`] = setInterval(tick, 1000);
}

function clearTimer(slot, i) {
  const key = `${slot}-${i}`;
  if (timers[key]) {
    clearInterval(timers[key]);
    delete timers[key];
  }
  const el = document.getElementById(`timer-${slot}-${i}`);
  if (el) el.innerText = "";
}

function updateTimers() {
  for (let key in liveCrops) {
    const [slot, i] = key.split("-").map(Number);
    updatePlot(slot, i, liveCrops[key]);
  }
}

function buySeed() {
  const uid = auth.currentUser.uid;
  db.ref(`users/${uid}`).once("value").then(snap => {
    const data = snap.val();
    if ((data?.coins || 0) >= 5) {
      db.ref(`users/${uid}/coins`).set((data.coins || 0) - 5);
      db.ref(`users/${uid}/seeds`).set((data.seeds || 0) + 1);
      document.getElementById("shop-msg").innerText = "Bought 1 seed!";
    } else {
      document.getElementById("shop-msg").innerText = "Not enough coins!";
    }
  });
}
