import http from "http";
import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
	if (req.url === "/health") {
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ status: "ok" }));
		return;
	}

	res.writeHead(200, { "Content-Type": "text/plain" });
	res.end("Smart Physics Ball WebSocket Relay\n");
});

const wss = new WebSocketServer({ server });
const clients = new Set();

const broadcast = (payload) => {
	for (const client of clients) {
		if (client.readyState === client.OPEN) {
			client.send(payload);
		}
	}
};

wss.on("connection", (socket) => {
	clients.add(socket);
	socket.isAlive = true;

	socket.on("pong", () => {
		socket.isAlive = true;
	});

	socket.on("message", (message) => {
		const payload = message.toString();
		broadcast(payload);
	});

	socket.on("close", () => {
		clients.delete(socket);
	});

	socket.on("error", () => {
		clients.delete(socket);
	});
});

const interval = setInterval(() => {
	for (const socket of clients) {
		if (!socket.isAlive) {
			socket.terminate();
			clients.delete(socket);
			continue;
		}
		socket.isAlive = false;
		socket.ping();
	}
}, 30000);

server.listen(PORT, () => {
	console.log(`WebSocket relay listening on port ${PORT}`);
});

const shutdown = () => {
	clearInterval(interval);
	wss.close(() => server.close(() => process.exit(0)));
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
