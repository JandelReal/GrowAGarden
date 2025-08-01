// 🔥 Replace this with your actual Firebase config
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

const gardenSize = 25;
const gardenEl = document.getElementById("garden");

auth.signInAnonymously().catch(console.error);

function createGrid() {
  for (let i = 0; i < gardenSize; i++) {
    const plot = document.createElement("div");
    plot.className = "plot";
    plot.id = `plot-${i}`;
    plot.addEventListener("click", () => plantCrop(i));
    gardenEl.appendChild(plot);
  }
}

for (let i = 0; i < gardenSize; i++) {
  db.ref(`garden/plot${i}`).on("value", snapshot => {
    const state = snapshot.val();
    const plot = document.getElementById(`plot-${i}`);
    if (!plot) return;
    plot.className = "plot";
    if (state === "planted") plot.classList.add("planted");
    if (state === "growing") plot.classList.add("growing");
    if (state === "ready")   plot.classList.add("ready");
  });
}

function plantCrop(i) {
  const plotRef = db.ref(`garden/plot${i}`);
  plotRef.once("value").then(snapshot => {
    const state = snapshot.val();
    if (!state) {
      plotRef.set("planted");
      setTimeout(() => plotRef.set("growing"), 3000);
      setTimeout(() => plotRef.set("ready"), 6000);
    }
  });
}

createGrid();
