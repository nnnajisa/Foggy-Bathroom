const express = require("express");
const app = express();
app.use(express.static("frontEnd"));
app.use("/models", express.static(__dirname));

const http = require("http").createServer(app);
const server = app.listen(8080);
console.log("Server running on http://localhost:8080");

const io = require("socket.io")().listen(server);

// shared state
let state = {
  humidity: 0.5,
  showerOn: true,
  lightOn: true,
};

let users = {};

const MIN_HUMIDITY = 0.5;
const MAX_HUMIDITY = 1.0;

// humidity loop — server is authoritative
setInterval(() => {
  if (state.showerOn) {
    state.humidity = Math.min(MAX_HUMIDITY, state.humidity + 0.002);
  } else {
    state.humidity = Math.max(MIN_HUMIDITY, state.humidity - 0.0008);
  }

  io.emit("state", state);
}, 100);

io.on("connection", (socket) => {
  console.log("connected:", socket.id);

  // send current state to new joiner
  socket.emit("state", state);

  socket.emit("initUser", socket.id);
  socket.emit("users", users);

  socket.on("msg", (data) => {
    socket.broadcast.emit("msg", data);
  });

  // relay mirror strokes to everyone else (sender already applied locally)
  socket.on("draw", (data) => {
    socket.broadcast.emit("draw", data);
  });

  socket.on("setShower", (val) => {
    state.showerOn = val;
    io.emit("state", state);
  });

  socket.on("setLight", (val) => {
    state.lightOn = val;
    io.emit("state", state);
  });

  socket.on("joinUser", (data) => {
   users[socket.id] = {
    id: socket.id,
    name: data.name || "guest",
    position: { x: 0, y: 1.4, z: 0 }
  };
  io.emit("users", users);
});

  socket.on("userMove", (data) => {
  if (!users[socket.id]) return;
  users[socket.id].position = data.position;
  socket.broadcast.emit("userMoved", users[socket.id]);
});
 socket.on("disconnect", () => {
  delete users[socket.id];
  io.emit("users", users);
  console.log("disconnected:", socket.id);
});
});
