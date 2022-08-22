import express, { Express, Request, Response } from "express";
import { createServer, Server } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import path from "path";

const app: Express = express();
const server: Server = createServer(app);
const port: string | number = process.env.PORT ?? 8081;
const io: SocketServer = new SocketServer(server, {
  cors: {
    origin: "*",
  },
});

let users: string[] = [];

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req: Request, res: Response) => {
  res.send("Hello from stream");
});

io.on("connection", (socket: Socket) => {
  users.push(socket.id);
  socket.emit(
    "users",
    users.filter((u) => u !== socket.id)
  );
  socket.broadcast.emit("new-user", socket.id);

  socket.on("callOffer", (to: string) => {
    socket.to(to).emit("callOffer", socket.id);
  });

  socket.on("declineCallOffer", (to: string) => {
    socket.to(to).emit("declineCallOffer", socket.id);
  });

  socket.on("acceptCallOffer", (to: string) => {
    socket.to(to).emit("acceptCallOffer", socket.id);
  });

  socket.on(
    "sdp",
    ({ to, sdp }: { to: string; sdp: RTCSessionDescriptionInit }) => {
      socket.to(to).emit("sdp", { from: socket.id, sdp });
    }
  );

  socket.on("iceCandidate", ({ to, candidate }) => {
    socket.to(to).emit("iceCandidate", { from: socket.id, candidate });
  });

  socket.on("msg", ({msg, to}) => {
    socket.to(to).emit("msg", {msg, from: socket.id});
  })

  socket.on("disconnect", () => {
    console.log("user disconnected");
    users = users.filter((u) => u !== socket.id);
    socket.broadcast.emit("user-disconnected", socket.id);
  });
});

server.listen(port, () => {
  console.log(`stream listening at http://localhost:${port}`);
});
