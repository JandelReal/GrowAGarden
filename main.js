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
let timers = {};

const gardenContainer = document.getElementById("garden-container");
const loginContainer = document.getElementById("login-container");
const emailInput = document.getElementById("email-input");
const passwordInput = document.getElementById("password-input");
const loginBtn = document.getElementById("login-btn");
const registerBtn = document.getElementById("register-btn");
const loginMsg = document.getElementById("login-msg");
const logoutBtn = document.getElementById("logout-btn");
const shopDiv = document.getElementById("shop");
const shopCoinsSpan = document.getElementById("shop-coins");
const buySeedBtn = document.getElementById("buy-seed-btn");
const shopMsg = document.getElementById("shop-msg");

// --- Authentication handlers ---

loginBtn.onclick = () => {
  loginMsg.innerText = "";
  auth.signInWithEmailAndPassword(emailInput.value, passwordInput.value)
    .then(cred => onLoginSuccess(cred.user))
    .catch(err => loginMsg.innerText = err.message);
};

registerBtn.onclick = () => {
  loginMsg.innerText = "";
  auth.createUserWithEmailAndPassword(emailInput.value, passwordInput.value)
    .then(cred => onLoginSuccess(cred.user))
    .catch(err => loginMsg.innerText = err.message);
};

logoutBtn.onclick = () => {
  auth.signOut();
};

// Called when user successfully logs in
function onLoginSuccess(user) {
  loginContainer.style.display = "none";
  gardenContainer.style.display = "grid";
  shopDiv.style.display = "block";
  logoutBtn.style.display = "block";

  userId = user.uid;
  const email = user.email || `user${Math.floor(Math.random() * 10000)}@example.com`;

  // Check if user already assigned to a slot
  db.ref("servers").once("value").then(snapshot => {
    const servers = snapshot.val() || {};
    let found = false;

    for (const sid in servers) {
      for (let s = 1; s <= MAX_PLAYERS; s++) {
        const slotData = servers[sid][`slot${s}`];
        if (slotData && slotData.uid === userId) {
          serverId = sid;
          currentSlot = s;
          playerName = slotData.name || email.split("@")[0];
          found = true;
          break;
        }
      }
      if (found) break;
    }

    if (found) {
      setupGame();
    } else {
      joinOrCreateServer(userId, email);
    }
  });
}

auth.onAuthStateChanged(user => {
  if (user) {
    onLoginSuccess(user);
  } else {
    loginContainer.style.display = "block";
    gardenContainer.style.display = "none";
    shopDiv.style.display = "none";
    logoutBtn.style.display = "none";
  }
});

// --- Game logic ---

function joinOrCreateServer(uid, email) {
  db.ref("servers").once("value").then(snapshot => {
    const servers = snapshot.val() || {};
    for (const id in servers) {
      for (let s = 1; s <= MAX_PLAYERS; s++) {
        if (!servers[id][`slot${s}`]) {
          assignSlot(id, s, uid, email);
          return;
        }
      }
    }
    const newServerRef = db.ref("servers").push();
    assignSlot(newServerRef.key, 1, uid, email);
  });
}

function assignSlot(id, slot, uid, email) {
  serverId = id;
  currentSlot = slot;
  userId = uid;

  const userRef = db.ref(`servers/${id}/slot${slot}`);
  const defaultName = email ? email.split("@")[0] : `Player_${Math.floor(Math.random() * 10000)}`;

  userRef.once("value").then(snapshot => {
    if (!snapshot.exists()) {
      userRef.set({
        uid: uid,
        name: defaultName,
        crops: {},
        coins: 0
      });
    }
    playerName = defaultName;

    // Give 1 seed to new players if none yet saved locally
    if (!localStorage.getItem("seeds")) {
      localStorage.setItem("seeds", "1");
    }

    setupGame();
  });
}

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
  if (slot !== currentSlot) return;

  const cropRef = db.ref(`servers/${serverId}/slot${slot}/crops/${i}`);
  cropRef.once("value").then(snapshot => {
    const data = snapshot.val();

    if (!data) {
      let seeds = parseInt(localStorage.getItem("seeds") || "0");
      if (seeds <= 0) {
        alert("You need seeds! Buy some in the shop.");
        return;
      }
      const plantedAt = Date.now();
      cropRef.set({ state: "planted", plantedAt });
      seeds--;
      localStorage.setItem("seeds", seeds);
    } else if (data.state === "ready") {
      const coinsRef = db.ref(`servers/${serverId}/slot${slot}/coins`);
      coinsRef.transaction(coins => (coins || 0) + 5);
      cropRef.remove();
    }
  });
}

function setupGame() {
  gardenContainer.innerHTML = "";
  timers = {};

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

// --- Shop logic ---

buySeedBtn.onclick = () => {
  const coinsRef = db.ref(`servers/${serverId}/slot${currentSlot}/coins`);
  coinsRef.transaction(coins => {
    if ((coins || 0) >= 5) {
      coins -= 5;
      addSeedToInventory();
      showShopMessage("Seed purchased!");
      updateShopCoins(coins);
      return coins;
    } else {
      showShopMessage("Not enough coins!");
      return;
    }
  });
};

function addSeedToInventory() {
  let seeds = parseInt(localStorage.getItem("seeds") || "0");
  seeds++;
  localStorage.setItem("seeds", seeds);
}

function showShopMessage(msg) {
  shopMsg.innerText = msg;
  setTimeout(() => { shopMsg.innerText = ""; }, 3000);
}

function updateShopCoins(coins) {
  shopCoinsSpan.innerText = coins;
}

