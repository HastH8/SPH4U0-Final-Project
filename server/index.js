import http from "http";
import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 8080;
const VERBOSE_LOG = true;

const log = (...args) => {
	if (!VERBOSE_LOG) return;
	const ts = new Date().toISOString();
	console.log(`[${ts}]`, ...args);
};

const server = http.createServer((req, res) => {
	log("HTTP request", req.method, req.url, {
		headers: req.headers,
	});
	if (req.url === "/health") {
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ status: "ok" }));
		return;
	}

	res.writeHead(200, { "Content-Type": "text/plain" });
	res.end("Smart Physics Ball WebSocket Relay\n");
});

server.on("upgrade", (req) => {
	log("HTTP upgrade", req.method, req.url, {
		headers: req.headers,
		ip: req.socket.remoteAddress || "",
		port: req.socket.remotePort || "",
	});
});

server.on("error", (err) => {
	log("HTTP server error", err?.message || err);
});

const wss = new WebSocketServer({ server });
const clients = new Set();

const broadcast = (payload, senderId = "unknown") => {
	log("Broadcasting message from", senderId, "to", clients.size, "clients");
	for (const client of clients) {
		if (client.readyState === client.OPEN) {
			try {
				client.send(payload);
				log("WS sent to", client.id, "bytes:", payload.length);
			} catch (err) {
				log("WS send error to", client.id, err?.message || err);
			}
		} else {
			log("WS skip send (not open)", client.id, "state:", client.readyState);
		}
	}
};

wss.on("connection", (socket, req) => {
	clients.add(socket);
	socket.isAlive = true;
	socket.id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
	log("WS connected", socket.id, "clients:", clients.size, {
		url: req?.url || "",
		headers: req?.headers || {},
		ip: req?.socket?.remoteAddress || "",
		port: req?.socket?.remotePort || "",
	});

	socket.on("pong", () => {
		socket.isAlive = true;
		log("WS pong", socket.id);
	});

	socket.on("ping", () => {
		log("WS ping", socket.id);
	});

	socket.on("message", (message, isBinary) => {
		const payload = isBinary ? message.toString("hex") : message.toString();
		log("WS message from", socket.id, {
			bytes: message.length,
			isBinary,
		});
		log("WS payload:", payload);
		broadcast(payload, socket.id);
	});

	socket.on("close", (code, reason) => {
		clients.delete(socket);
		log(
			"WS closed",
			socket.id,
			"code:",
			code,
			"reason:",
			reason?.toString?.() || ""
		);
	});

	socket.on("error", (err) => {
		clients.delete(socket);
		log("WS error", socket.id, err?.message || err);
	});
});

wss.on("error", (err) => {
	log("WS server error", err?.message || err);
});

const interval = setInterval(() => {
	for (const socket of clients) {
		if (!socket.isAlive) {
			log("WS heartbeat failed, terminating", socket.id);
			socket.terminate();
			clients.delete(socket);
			continue;
		}
		socket.isAlive = false;
		log("WS ping", socket.id);
		socket.ping();
	}
}, 30000);

server.listen(PORT, () => {
	log(`WebSocket relay listening on port ${PORT}`);
});

const shutdown = () => {
	clearInterval(interval);
	wss.close(() => server.close(() => process.exit(0)));
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
