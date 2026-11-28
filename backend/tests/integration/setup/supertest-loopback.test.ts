import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";

function echoLocalAddress() {
  const app = express();
  app.get("/where", (req, res) => {
    res.json({ localAddress: req.socket.localAddress });
  });
  return app;
}

describe("supertest loopback setup", () => {
  it("serves the app on 127.0.0.1, the address supertest connects to", async () => {
    const response = await request(echoLocalAddress()).get("/where");

    expect(response.status).toBe(200);
    expect(response.body.localAddress).toBe("127.0.0.1");
  });

  it("lets concurrent requests from one agent share the pending listen", async () => {
    const agent = request.agent(echoLocalAddress());

    const responses = await Promise.all([
      agent.get("/where"),
      agent.get("/where"),
    ]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
  });
});
