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
let playerName = "Anonymous";

const gardenContainer = document.getElementById("garden-container");

function createPlayerGrid(slot, isOwnPlot) {
  const section = document.createElement("div");
  section.className = "player-section";
  section.id = "section-" + slot;

  const nameEl = document.createElement("div");
  nameEl.className = "player-name";
  nameEl.innerText = "Loading...";
  nameEl.id = "name-" + slot;

  const grid = document.createElement("div");
  grid.className = "grid";
  grid.id = "grid-" + slot;

  for (let i = 0; i < GARDEN_SIZE; i++) {
    const plot = document.createElement("div");
    plot.className = "plot";
    plot.id = `plot-${slot}-${i}`;
    if (isOwnPlot) {
      plot.addEventListener("click", () => plantCrop(slot, i));
    }
    // Add timer text element inside each plot
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

  section.appendChild(nameEl);
  section.appendChild(grid);
  gardenContainer.appendChild(section);
}

function updatePlot(slot, i, data) {
  const plot = document.getElementById(`plot-${slot}-${i}`);
  const timerText = document.getElementById(`timer-${slot}-${i}`);
  if (!plot || !timerText) return;

  plot.className = "plot";
  timerText.innerText = "";

  if (!data) return;

  const { state, plantedAt } = data;

  if (state === "planted") {
    plot.classList.add("planted");
    showTimer(slot, i, plantedAt, 3);
  } else if (state === "growing") {
    plot.classList.add("growing");
    showTimer(slot, i, plantedAt, 6);
  } else if (state === "ready") {
    plot.classList.add("ready");
  }
}

// Show countdown timer in seconds until next stage
function showTimer(slot, i, plantedAt, durationSeconds) {
  const timerText = document.getElementById(`timer-${slot}-${i}`);
  if (!timerText) return;

  const intervalId = setInterval(() => {
    const now = Date.now();
    const elapsed = (now - plantedAt);
    const remaining = durationSeconds * 1000 - elapsed;

    if (remaining <= 0) {
      timerText.innerText = "";
      clearInterval(intervalId);
    } else {
      timerText.innerText = `${Math.ceil(remaining / 1000)}s`;
    }
  }, 500);
}

function plantCrop(slot, i) {
  const ref = db.ref(`servers/${serverId}/slot${slot}/crops/${i}`);
  ref.once("value").then(snapshot => {
    const val = snapshot.val();
    if (!val || val.state === "ready") {
      const plantedAt = Date.now();
      ref.set({ state: "planted", plantedAt });

      setTimeout(() => {
        ref.update({ state: "growing" });
      }, 3000);

      setTimeout(() => {
        ref.update({ state: "ready" });
      }, 6000);
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
  userRef.set({
    uid: uid,
    name: playerName,
    crops: {}
  });
  setupGame();
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

    for (let i = 0; i < GARDEN_SIZE; i++) {
      const cropRef = db.ref(`servers/${serverId}/slot${s}/crops/${i}`);
      cropRef.on("value", snap => updatePlot(s, i, snap.val()));
    }
  }
}

auth.signInAnonymously().then(cred => {
  playerName = "Player_" + Math.floor(Math.random() * 10000);
  joinOrCreateServer(cred.user.uid);
});

