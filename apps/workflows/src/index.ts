/**
 * Render Workflows entrypoint for Answer Arena.
 * Side-effect imports register every durable task with the Workflows runtime.
 * The web service starts work by name (for example `run_bakeoff`); it does not
 * import this file.
 */
import "./tasks/ingest.js";
import "./tasks/trial.js";
import "./tasks/orchestrator.js";

console.log("Answer Arena workflow tasks registered.");
