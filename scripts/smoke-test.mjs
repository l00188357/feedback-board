const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:8080";

async function check(name, path, validate) {
  const url = BASE_URL + path;

  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      const body = await response.text();

      if (!validate(body)) {
        throw new Error("Unexpected response content");
      }

      console.log("PASS: " + name);
      return;
    } catch (error) {
      if (attempt === 30) {
        throw new Error(
          name + " failed: " + error.message
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

try {
  console.log("Starting Feedback Board smoke tests...");

  await check("Frontend Astro", "/", (body) =>
    body.includes("Have something to share?")
  );

  await check("PocketBase health through Nginx", "/api/health", (body) => {
    const data = JSON.parse(body);
    return data.code === 200;
  });

  await check(
    "Feedback collection API",
    "/api/collections/feedbacks/records",
    (body) => {
      const data = JSON.parse(body);
      return Array.isArray(data.items);
    }
  );

  console.log("All smoke tests passed!");
} catch (error) {
  console.error("FAIL:", error.message);
  process.exitCode = 1;
}