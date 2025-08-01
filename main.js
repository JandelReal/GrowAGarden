// 🔥 Replace with your Firebase config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_ID",
  appId: "YOUR_APP_ID"
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

// Create 6 player plot sections
const gardenContainer = document.getElementById("garden-container");

// Helper to create 5x5 grid
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
    grid.appendChild(plot);
  }

  section.appendChild(nameEl);
  section.appendChild(grid);
  gardenContainer.appendChild(section);
}

function updatePlot(slot, i, state) {
  const plot = document.getElementById(`plot-${slot}-${i}`);
  if (!plot) return;
  plot.className = "plot";
  if (state === "planted") plot.classList.add("planted");
  if (state === "growing") plot.classList.add("growing");
  if (state === "ready") plot.classList.add("ready");
}

function plantCrop(slot, i) {
  const ref = db.ref(`servers/${serverId}/slot${slot}/crops/${i}`);
  ref.once("value").then(snapshot => {
    if (!snapshot.exists()) {
      ref.set("planted");
      setTimeout(() => ref.set("growing"), 3000);
      setTimeout(() => ref.set("ready"), 6000);
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
