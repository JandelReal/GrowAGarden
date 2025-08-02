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

const loginContainer = document.getElementById("login-container");
const loginBtn = document.getElementById("login-btn");
const registerBtn = document.getElementById("register-btn");
const logoutBtn = document.getElementById("logout-btn");
const loginMsg = document.getElementById("login-msg");
const gardenContainer = document.getElementById("garden-container");
const shopCoins = document.getElementById("shop-coins");
const shopSeeds = document.getElementById("shop-seeds");
const shopMsg = document.getElementById("shop-msg");
const buySeedBtn = document.getElementById("buy-seed-btn");
const shop = document.getElementById("shop");

let gardenRef = null;
let currentUID = null;

// Auth
loginBtn.onclick = () => {
  const email = document.getElementById("email-input").value;
  const pass = document.getElementById("password-input").value;
  auth.signInWithEmailAndPassword(email, pass)
    .catch(err => loginMsg.textContent = err.message);
};

registerBtn.onclick = () => {
  const email = document.getElementById("email-input").value;
  const pass = document.getElementById("password-input").value;
  auth.createUserWithEmailAndPassword(email, pass)
    .then(cred => {
      const uid = cred.user.uid;
      db.ref("players/" + uid).set({
        name: email.split("@")[0],
        seeds: 1,
        coins: 0,
        plots: Array(6).fill({ state: "empty", plantedAt: 0 })
      });
    })
    .catch(err => loginMsg.textContent = err.message);
};

logoutBtn.onclick = () => auth.signOut();

auth.onAuthStateChanged(user => {
  if (user) {
    loginContainer.style.display = "none";
    logoutBtn.style.display = "block";
    shop.style.display = "block";
    currentUID = user.uid;
    loadGame(user.uid);
  } else {
    loginContainer.style.display = "block";
    logoutBtn.style.display = "none";
    shop.style.display = "none";
    gardenContainer.innerHTML = "";
  }
});

// Load game for current user and 5 others
function loadGame(uid) {
  db.ref("players").once("value").then(snapshot => {
    const players = snapshot.val();
    const all = Object.entries(players || {});
    const group = all.slice(0, 6);
    gardenContainer.innerHTML = "";
    group.forEach(([id, data]) => renderPlayerGarden(id, data, uid));
    updateShop(uid);
  });
}

// Render garden
function renderPlayerGarden(id, data, currentUID) {
  const section = document.createElement("div");
  section.className = "player-section";
  const name = document.createElement("div");
  name.className = "player-name";
  name.textContent = data.name;
  section.appendChild(name);

  const grid = document.createElement("div");
  grid.className = "grid";

  (data.plots || []).forEach((plot, index) => {
    const div = document.createElement("div");
    div.className = "plot";
    const now = Date.now();
    const plantedAt = Number(plot.plantedAt || 0);
    const elapsed = now - plantedAt;

    let state = plot.state;
    if (state === "planted" && elapsed > 10000) {
      state = "ready";
    } else if (state === "planted" && elapsed > 5000) {
      state = "growing";
    }

    div.classList.add(state);
    if (state === "planted" || state === "growing") {
      const remaining = Math.ceil((10000 - elapsed) / 1000);
      const timer = document.createElement("div");
      timer.className = "timer-text";
      timer.textContent = `${remaining}s`;
      div.appendChild(timer);
    }

    if (id === currentUID) {
      div.onclick = () => handlePlotClick(currentUID, index);
    }

    grid.appendChild(div);
  });

  section.appendChild(grid);
  gardenContainer.appendChild(section);
}

function handlePlotClick(uid, index) {
  if (!auth.currentUser) {
    alert("You're not logged in yet.");
    return;
  }

  const ref = db.ref("players/" + uid);
  ref.once("value").then(snap => {
    const data = snap.val();
    if (!data || !data.plots || !Array.isArray(data.plots)) return;

    const plot = data.plots[index];
    if (!plot) return;

    if (plot.state === "ready") {
      data.plots[index] = { state: "empty", plantedAt: 0 };
      data.coins = (data.coins || 0) + 3;
    } else if (plot.state === "empty") {
      if ((data.seeds || 0) > 0) {
        data.seeds -= 1;
        data.plots[index] = { state: "planted", plantedAt: Date.now() };
      } else {
        shopMsg.textContent = "You have no seeds!";
        return;
      }
    }

    ref.update({
      seeds: data.seeds,
      coins: data.coins,
      plots: data.plots
    }).then(() => {
      loadGame(uid);
    });
  });
}

// Shop
buySeedBtn.onclick = () => {
  if (!currentUID) return;
  const ref = db.ref("players/" + currentUID);
  ref.once("value").then(snap => {
    const data = snap.val();
    if ((data.coins || 0) >= 5) {
      ref.update({
        coins: data.coins - 5,
        seeds: (data.seeds || 0) + 1
      }).then(() => {
        shopMsg.textContent = "Seed purchased!";
        updateShop(currentUID);
        loadGame(currentUID);
      });
    } else {
      shopMsg.textContent = "Not enough coins!";
    }
  });
};

function updateShop(uid) {
  db.ref("players/" + uid).once("value").then(snap => {
    const data = snap.val();
    shopCoins.textContent = data.coins || 0;
    shopSeeds.textContent = data.seeds || 0;
  });
}
