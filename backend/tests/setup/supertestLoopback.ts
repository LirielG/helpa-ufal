import http from "node:http";
import { Test } from "supertest";

// supertest starts the app with `listen(0)` and no host, so Node binds the
// wildcard `[::]`, but it then connects to `127.0.0.1:<port>`. On macOS the
// kernel can hand that wildcard socket a port another local process already
// listens on at 127.0.0.1; the request then reaches that process, which
// answers 404, and a random test fails. Binding to 127.0.0.1 makes the
// address supertest connects to the one the app actually owns.
//
// With an explicit host the port is only known after the "listening" event,
// while supertest builds the URL in the constructor, so the port is filled in
// right before the request is sent. Until then the URL carries host and path
// without a port: request.agent() reads it at once to pick the cookies to
// attach, and cookie matching ignores the port.

type LoopbackTest = Test & {
  _server?: http.Server;
  _loopbackServer?: http.Server;
  _loopbackPath?: string;
};

if (typeof Test.prototype.serverAddress !== "function") {
  throw new Error(
    "supertest no longer exposes Test.prototype.serverAddress; revisit tests/setup/supertestLoopback.ts",
  );
}

const originalServerAddress = Test.prototype.serverAddress;
const originalEnd = Test.prototype.end;

// request.agent() shares one server between its requests. A request built
// while another one's listen is still pending must wait for that listen
// instead of calling listen() again on the same server.
const pendingListens = new WeakSet<http.Server>();

function whenListening(server: http.Server): Promise<void> {
  if (server.listening) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const onListening = (): void => {
      server.off("error", onError);
      resolve();
    };
    const onError = (error: Error): void => {
      server.off("listening", onListening);
      reject(error);
    };
    server.once("listening", onListening);
    server.once("error", onError);
  });
}

Test.prototype.serverAddress = function (
  this: LoopbackTest,
  app,
  path,
): string {
  if (!(app instanceof http.Server)) {
    return originalServerAddress.call(this, app, path);
  }

  if (!app.address() && !pendingListens.has(app)) {
    // Owning the server (`_server`) is what makes supertest close it after
    // the response, exactly as it does for the servers it starts itself.
    this._server = app.listen(0, "127.0.0.1");
    pendingListens.add(app);
    whenListening(app).then(
      () => pendingListens.delete(app),
      () => pendingListens.delete(app),
    );
  }

  this._loopbackServer = app;
  this._loopbackPath = path;
  return `http://127.0.0.1${path}`;
};

Test.prototype.end = function (this: LoopbackTest, callback) {
  const server = this._loopbackServer;
  const path = this._loopbackPath;

  if (!server || path === undefined) {
    return originalEnd.call(this, callback);
  }

  whenListening(server).then(
    () => {
      const { port } = server.address() as { port: number };
      this._loopbackPath = undefined;
      this.url = `http://127.0.0.1:${port}${path}`;
      originalEnd.call(this, callback);
    },
    (error: Error) => {
      if (callback) callback(error, undefined as never);
      else this.emit("error", error);
    },
  );

  return this;
};
