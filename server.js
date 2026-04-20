import { HTTP_PORT } from "./src/config.js";
import { createHttpServer, startHeartbeat } from "./src/http-server.js";
import { connectToQlab } from "./src/qlab.js";
import { getSettings } from "./src/settings.js";
import { state } from "./src/state.js";
import { broadcastSnapshot } from "./src/events.js";

const server = createHttpServer();

server.listen(HTTP_PORT, () => {
  console.log(`QLab Screen is running at http://localhost:${HTTP_PORT}`);
  startHeartbeat();

  const settings = getSettings();
  if (settings.autoConnect && settings.host) {
    connectToQlab(settings).catch((error) => {
      state.lastError = error.message;
      broadcastSnapshot();
    });
  }
});
