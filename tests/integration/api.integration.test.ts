import { spawn, type ChildProcess } from "node:child_process";
import supertest from "supertest";

let serverProcess: ChildProcess;
const API_URL = "http://localhost:4989";

// Helper function to wait for the server to start
async function waitForServer(url: string, timeout = 10000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const res = await supertest(url).get("/api/decks");
      if (res.status < 500) return;
    } catch (e) {
      // server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Server did not start in time");
}

beforeAll(async () => {
  // Spawn the API server process using the cli command
  serverProcess = spawn("bun", ["run", "start", "serve", "-d"], {
    env: { ...process.env, PORT: "4989" },
    stdio: "inherit", // or "pipe" if you want to capture logs
  });

  // Optionally: Spawn headless anki or ensure it is already running

  // Wait until the server is ready
  await waitForServer(API_URL);
});

afterAll(() => {
  if (serverProcess) {
    serverProcess.kill();
  }
  // Optionally: Shut down the headless anki process/container
});

describe("Integration tests against running API", () => {
  it("GET /api/decks returns decks", async () => {
    const response = await supertest(API_URL).get("/api/decks");
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("decks");
  });

  it("GET /api/decks/:name/cards returns cards array", async () => {
    const response = await supertest(API_URL).get("/api/decks/NonExistentDeck/cards");
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it("GET /api/cards/:id returns 404 for non-existent card", async () => {
    const response = await supertest(API_URL).get("/api/cards/999999");
    expect(response.status).toBe(404);
  });

  it("POST /api/cards/:id/answer rejects invalid ease value", async () => {
    const response = await supertest(API_URL)
      .post("/api/cards/9999/answer")
      .send({ ease: 5 });
    expect(response.status).toBe(400);
  });

  it("POST /api/cards/:id/answer returns 404 for non-existent card with valid ease", async () => {
    const response = await supertest(API_URL)
      .post("/api/cards/9999/answer")
      .send({ ease: 3 });
    expect(response.status).toBe(404);
  });

  it("POST /api/cards/:id/regenerate returns 404 for non-existent card", async () => {
    const response = await supertest(API_URL)
      .post("/api/cards/9999/regenerate");
    expect(response.status).toBe(404);
  });

  it("GET /api/audio/:filename returns 404 for missing audio file", async () => {
    const response = await supertest(API_URL).get("/api/audio/missing.mp3");
    expect(response.status).toBe(404);
  });

  it("GET /api/decks/:name/config returns 404 for non-existent deck config", async () => {
    const response = await supertest(API_URL).get("/api/decks/NonExistentDeck/config");
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Deck configuration not found" });
  });

  it("POST /api/sync returns success", async () => {
    const response = await supertest(API_URL)
      .post("/api/sync");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
  });
});
