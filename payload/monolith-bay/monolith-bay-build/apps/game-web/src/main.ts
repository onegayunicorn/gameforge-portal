import { bootstrap } from "./bootstrap";

bootstrap()
  .then(() => {
    console.info("[MonolithBay] Boot sequence complete.");
  })
  .catch((error) => {
    console.error("[MonolithBay] Boot failed:", error);
    const status = document.getElementById("boot-status");
    if (status) {
      status.textContent = "Failed to initialize. See console for details.";
    }
  });
