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

const GARDEN_SIZE = 25; // 5x5 plots per player
const MAX_PLAYERS = 6;

let currentSlot = null, serverId = null, userId = null, playerName = null;
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
const shopSeedsSpan = document.getElementById("shop-seeds");
const buySeedBtn = document.getElementById("buy-seed-btn");
const shopMsg = document.getElementById("shop-msg");

// --- AUTHENTICATION HANDLERS ---

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

logoutBtn.onclick = () => auth.signOut();

function onLoginSuccess(user) {
  loginContainer.style.display = "none";
  gardenContainer.style.display = "grid";
  shopDiv.style.display = "block";
  logoutBtn.style.display = "block";
  userId = user.uid;
  const email = user.email || `user${Math.floor(Math.random()*10000)}@example.com`;

  // Check if user is already assigned a slot on a server
  db.ref("servers").once("value").then(snapshot => {
    const servers = snapshot.val() || {};
    let found = false;
    for (const sid in servers) {
      for (let s = 1; s <= MAX_PLAYERS; s++) {
        const d = servers[sid][`slot${s}`];
        if (d && d.uid === userId) {
          serverId = sid;
          currentSlot = s;
          playerName = d.name || email.split("@")[0];
          found = true;
          break;
        }
      }
      if (found) break;
    }
    found ? setupGame() : joinOrCreateServer(userId, email);
  });
}

auth.onAuthStateChanged(user => {
  if (user) onLoginSuccess(user);
  else {
    loginContainer.style.display = "block";
    gardenContainer.style.display = "none";
    shopDiv.style.display = "none";
    logoutBtn.style.display = "none";
  }
});

function joinOrCreateServer(uid, email) {
  db.ref("servers").once("value").then(snapshot => {
    const servers = snapshot.val() || {};
    for (const id in servers) {
      for (let s = 1; s <= MAX_PLAYERS; s++) {
        if (!servers[id][`slot${s}`]) {
          return assignSlot(id, s, uid, email);
        }
      }
    }
    // No available slots, create new server
    const newRef = db.ref("servers").push();
    assignSlot(newRef.key, 1, uid, email);
  });
}

function assignSlot(id, slot, uid, email) {
  serverId = id;
  currentSlot = slot;
  userId = uid;
  const defaultName = email ? email.split("@")[0] : `Player_${Math.floor(Math.random()*10000)}`;
  db.ref(`servers/${id}/slot${slot}`).once("value").then(snap => {
    if (!snap.exists()) {
      db.ref(`servers/${id}/slot${slot}`).set({
        uid, name: defaultName, crops: {}, coins: 0, seeds: 1
      });
    }
    playerName = defaultName;
    setupGame();
  });
}

// --- SETUP GARDEN UI AND LISTENERS ---

function setupGame() {
  gardenContainer.innerHTML = "";
  db.ref(`servers/${serverId}`).once("value").then(snapshot => {
    const data = snapshot.val() || {};
    for (let s = 1; s <= MAX_PLAYERS; s++) {
      const slotData = data[`slot${s}`];
      if (!slotData) continue;

      // Player container
      const playerDiv = document.createElement("div");
      playerDiv.className = "player-section";

      // Player name header
      const nameEl = document.createElement("div");
      nameEl.className = "player-name";
      nameEl.innerText = slotData.name || `Player ${s}`;
      playerDiv.appendChild(nameEl);

      // Garden grid
      const grid = document.createElement("div");
      grid.className = "grid";
      for (let i = 0; i < GARDEN_SIZE; i++) {
        const plot = document.createElement("div");
        plot.className = "plot";
        plot.id = `plot-${s}-${i}`;
        if (s === currentSlot) {
          plot.onclick = () => handleCropClick(s, i);
        }
        const timer = document.createElement("div");
        timer.className = "timer-text";
        timer.id = `timer-${s}-${i}`;
        plot.appendChild(timer);
        grid.appendChild(plot);
      }
      playerDiv.appendChild(grid);
      gardenContainer.appendChild(playerDiv);

      // Listen for crops changes on this slot
      db.ref(`servers/${serverId}/slot${s}/crops`).on("value", snap => {
        const crops = snap.val() || {};
        for (let i = 0; i < GARDEN_SIZE; i++) {
          updatePlot(s, i, crops[i]);
        }
      });

      // Listen for coins changes on this slot
      db.ref(`servers/${serverId}/slot${s}/coins`).on("value", snap => {
        if (s === currentSlot) {
          shopCoinsSpan.innerText = snap.val() || 0;
        }
      });

      // Listen for seeds changes on this slot
      db.ref(`servers/${serverId}/slot${s}/seeds`).on("value", snap => {
        if (s === currentSlot) {
          shopSeedsSpan.innerText = snap.val() || 0;
        }
      });
    }
  });
}

// --- CROP PLANTING, HARVESTING, AND UPDATES ---

function handleCropClick(slot, i) {
  const cropRef = db.ref(`servers/${serverId}/slot${slot}/crops/${i}`);
  cropRef.once("value").then(snap => {
    const data = snap.val();
    if (!data) {
      // Plant crop if seeds available
      const seedRef = db.ref(`servers/${serverId}/slot${slot}/seeds`);
      seedRef.transaction(seeds => {
        if ((seeds || 0) <= 0) {
          alert("You need seeds! Buy some in the shop.");
          return;
        } else {
          cropRef.set({ plantedAt: Date.now() });
          return (seeds || 0) - 1;
        }
      });
    } else {
      // Harvest if ready
      const elapsed = Date.now() - data.plantedAt;
      if (elapsed >= 9000) {
        cropRef.remove();
        db.ref(`servers/${serverId}/slot${slot}/coins`).transaction(coins => (coins || 0) + 5);
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

  const plantedAt = data.plantedAt;
  const now = Date.now();
  const elapsed = now - plantedAt;

  console.log(`Plot ${slot}-${i}: plantedAt=${plantedAt}, now=${now}, elapsed=${elapsed}`);

  const isReady = elapsed >= 9000;
  const isGrowing = elapsed >= 3000 && elapsed < 9000;

  if (isReady) {
    plot.classList.add("ready");
    clearTimer(slot, i);
  } else if (isGrowing) {
    plot.classList.add("growing");
    showTimer(slot, i, plantedAt, 9);
  } else {
    plot.classList.add("planted");
    showTimer(slot, i, plantedAt, 3);
  }
}

function showTimer(slot, i, plantedAt, targetSec) {
  const timerText = document.getElementById(`timer-${slot}-${i}`);
  if (!timerText) return;

  const key = `${slot}-${i}`;
  if (timers[key]) clearInterval(timers[key]);

  timers[key] = setInterval(() => {
    const now = Date.now();
    const elapsed = now - plantedAt;
    const remaining = targetSec * 1000 - elapsed;

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
  const key = `${slot}-${i}`;
  const timerText = document.getElementById(`timer-${slot}-${i}`);
  if (timerText) timerText.innerText = "";
  if (timers[key]) {
    clearInterval(timers[key]);
    delete timers[key];
  }
}

// --- SHOP FUNCTIONALITY ---

buySeedBtn.onclick = () => {
  const coinsRef = db.ref(`servers/${serverId}/slot${currentSlot}/coins`);
  const seedsRef = db.ref(`servers/${serverId}/slot${currentSlot}/seeds`);

  coinsRef.transaction(coins => {
    if ((coins || 0) >= 5) {
      seedsRef.transaction(seeds => (seeds || 0) + 1);
      showShopMessage("Seed purchased!");
      return (coins || 0) - 5;
    } else {
      showShopMessage("Not enough coins!");
      return;
    }
  });
};

function showShopMessage(msg) {
  shopMsg.innerText = msg;
  setTimeout(() => {
    shopMsg.innerText = "";
  }, 3000);
}


