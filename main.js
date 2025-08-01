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
const db = firebase.database();
const auth = firebase.auth();

const GARDEN_SIZE = 25;
const MAX_PLAYERS = 6;

let currentSlot = null;
let serverId = null;
let userId = null;
let playerName = null;
let timers = {}; // For countdown timers per plot

const gardenContainer = document.getElementById("garden-container");

// --- UI for Name Login and Shop ---

// Prompt player to enter name
function promptPlayerName() {
  let name = prompt("Enter your player name:", "");
  if (!name || name.trim() === "") {
    name = "Player_" + Math.floor(Math.random() * 10000);
  }
  return name.trim();
}

// Create the Shop UI element
function createShopUI() {
  const shopDiv = document.createElement("div");
  shopDiv.id = "shop";
  shopDiv.style = "position:fixed; bottom:20px; right:20px; background:#4caf50; color:#fff; padding:15px; border-radius:10px; max-width:250px; font-family:sans-serif;";

  shopDiv.innerHTML = `
    <h3>🌾 Shop</h3>
    <div>Coins: <span id="shop-coins">0</span></div>
    <button id="buy-seed-btn">Buy Seed (5 coins)</button>
    <p id="shop-msg" style="margin-top:8px; min-height:18px;"></p>
  `;

  document.body.appendChild(shopDiv);

  document.getElementById("buy-seed-btn").addEventListener("click", buySeed);
}

// Buy seed function (example, stores seeds in localStorage)
function buySeed() {
  const coinsRef = db.ref(`servers/${serverId}/slot${currentSlot}/coins`);
  coinsRef.transaction(coins => {
    if ((coins || 0) >= 5) {
      // Deduct coins
      coins -= 5;
      addSeedToInventory();
      showShopMessage("Seed purchased!");
      updateShopCoins(coins);
      return coins;
    } else {
      showShopMessage("Not enough coins!");
      return; // abort transaction
    }
  });
}

function addSeedToInventory() {
  let seeds = parseInt(localStorage.getItem("seeds") || "0");
  seeds++;
  localStorage.setItem("seeds", seeds);
}

function showShopMessage(msg) {
  const msgEl = document.getElementById("shop-msg");
  if (msgEl) {
    msgEl.innerText = msg;
    setTimeout(() => { msgEl.innerText = ""; }, 3000);
  }
}

function updateShopCoins(coins) {
  const coinsEl = document.getElementById("shop-coins");
  if (coinsEl) {
    coinsEl.innerText = coins;
  }
}

// --- Garden UI and game logic ---

function createPlayerGrid(slot, isOwnPlot) {
  const section = document.createElement("div");
  section.className = "player-section";
  section.id = "section-" + slot;

  const nameEl = document.createElement("div");
  nameEl.className = "player-name";
  nameEl.id = "name-" + slot;
  nameEl.innerText = "Loading...";

  const coinsEl = document.createElement("div");
  coinsEl.id = `coins-${slot}`;
  coinsEl.style.fontWeight = "bold";
  coinsEl.style.color = "#2e7d32";
  coinsEl.style.marginBottom = "8px";
  coinsEl.innerText = "Coins: 0";

  section.appendChild(nameEl);
  section.appendChild(coinsEl);

  const grid = document.createElement("div");
  grid.className = "grid";
  grid.id = "grid-" + slot;

  for (let i = 0; i < GARDEN_SIZE; i++) {
    const plot = document.createElement("div");
    plot.className = "plot";
    plot.id = `plot-${slot}-${i}`;
    if (isOwnPlot) {
      plot.addEventListener("click", () => handleCropClick(slot, i));
    }
    // Timer text
    const timerText = document.createElement("div");
    timerText.className = "timer-text";
    timerText.id = `timer-${slot}-${i}`;
    timerText.style.fontSize = "10px";
    timerText.style.color = "white";
    timerText.style.position = "relative";
    timerText.style.top = "-28px";
    plot.appendChild(timerText);

    grid.appendChild(plot);
  }

  section.appendChild(grid);
  gardenContainer.appendChild(section);
}

function updatePlot(slot, i, data) {
  const plot = document.getElementById(`plot-${slot}-${i}`);
  const timerText = document.getElementById(`timer-${slot}-${i}`);
  if (!plot || !timerText) return;

  plot.className = "plot";
  timerText.innerText = "";

  if (!data) {
    clearTimer(slot, i);
    return;
  }

  const { state, plantedAt } = data;

  if (state === "planted") {
    plot.classList.add("planted");
    showTimer(slot, i, plantedAt, 3);
  } else if (state === "growing") {
    plot.classList.add("growing");
    showTimer(slot, i, plantedAt, 6);
  } else if (state === "ready") {
    plot.classList.add("ready");
    clearTimer(slot, i);
  }
}

function showTimer(slot, i, plantedAt, durationSeconds) {
  const timerText = document.getElementById(`timer-${slot}-${i}`);
  if (!timerText) return;

  const key = slot + "-" + i;

  if (timers[key]) {
    clearInterval(timers[key]);
  }

  timers[key] = setInterval(() => {
    const now = Date.now();
    const elapsed = now - plantedAt;
    const remaining = durationSeconds * 1000 - elapsed;

    if (remaining <= 0) {
      timerText.innerText = "";
      clearInterval(timers[key]);
      delete timers[key];
    } else {
      timerText.innerText = `${Math.ceil(remaining / 1000)}s`;
    }
  }, 500);
}

function clearTimer(slot, i) {
  const key = slot + "-" + i;
  if (timers[key]) {
    clearInterval(timers[key]);
    delete timers[key];
  }
}

function handleCropClick(slot, i) {
  if (slot !== currentSlot) return; // Only own plot

  const cropRef = db.ref(`servers/${serverId}/slot${slot}/crops/${i}`);
  cropRef.once("value").then(snapshot => {
    const data = snapshot.val();

    if (!data) {
      // Check if player has seeds to plant
      let seeds = parseInt(localStorage.getItem("seeds") || "0");
      if (seeds <= 0) {
        alert("You need seeds! Buy some in the shop.");
        return;
      }
      // Plant crop
      const plantedAt = Date.now();
      cropRef.set({ state: "planted", plantedAt });
      seeds--;
      localStorage.setItem("seeds", seeds);
    } else if (data.state === "ready") {
      // Harvest crop, earn coins, reset crop
      const coinsRef = db.ref(`servers/${serverId}/slot${slot}/coins`);
      coinsRef.transaction(coins => (coins || 0) + 5);

      cropRef.remove();
    }
  });
}

function joinOrCreateServer(uid) {
  db.ref("servers").once("value").then(snapshot => {
    const servers = snapshot.val() || {};
    for (const id in servers) {
      for (let s = 1; s <= MAX_PLAYERS; s++) {
        if (!servers[id][`slot${s}`]) {
          assignSlot(id, s, uid);
          return;
        }
      }
    }
    const newServerRef = db.ref("servers").push();
    assignSlot(newServerRef.key, 1, uid);
  });
}

function assignSlot(id, slot, uid) {
  serverId = id;
  currentSlot = slot;
  userId = uid;
  const userRef = db.ref(`servers/${id}/slot${slot}`);

  userRef.once("value").then(snapshot => {
    if (!snapshot.exists()) {
      userRef.set({
        uid: uid,
        name: playerName,
        crops: {},
        coins: 0
      });
    }
    setupGame();
  });
}

function setupGame() {
  for (let s = 1; s <= MAX_PLAYERS; s++) {
    const isOwn = (s === currentSlot);
    createPlayerGrid(s, isOwn);

    const nameRef = db.ref(`servers/${serverId}/slot${s}/name`);
    nameRef.on("value", snap => {
      const name = snap.val() || `Player ${s}`;
      const nameEl = document.getElementById(`name-${s}`);
      if (nameEl) nameEl.innerText = name;
    });

    const coinsRef = db.ref(`servers/${serverId}/slot${s}/coins`);
    coinsRef.on("value", snap => {
      const coinsEl = document.getElementById(`coins-${s}`);
      if (coinsEl) coinsEl.innerText = `Coins: ${snap.val() || 0}`;
      if (s === currentSlot) updateShopCoins(snap.val() || 0);
    });

    for (let i = 0; i < GARDEN_SIZE; i++) {
      const cropRef = db.ref(`servers/${serverId}/slot${s}/crops/${i}`);
      cropRef.on("value", snap => updatePlot(s, i, snap.val()));
    }
  }
}

// --- Start Game ---

playerName = promptPlayerName();

auth.signInAnonymously().then(cred => {
  userId = cred.user.uid;
  joinOrCreateServer(userId);
  createShopUI();
});

