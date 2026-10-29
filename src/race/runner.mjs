import { Worker } from "node:worker_threads";

export function raceJob(action, input) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./worker.mjs", import.meta.url), {
      workerData: { action, input },
      env: {},
      execArgv: [],
      resourceLimits: { maxOldGenerationSizeMb: 128, stackSizeMb: 4 },
    });
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error("RaceLab stopped this operation after 25 seconds."));
    }, 25000);
    worker.once("message", (message) => {
      clearTimeout(timer);
      worker.terminate();
      if (message.error) reject(new Error(message.error));
      else resolve(message.result);
    });
    worker.once("error", (error) => {
      clearTimeout(timer);
      reject(new Error(`Isolated runner: ${error.message}`));
    });
    worker.once("exit", (code) => {
      clearTimeout(timer);
      if (code !== 0)
        reject(
          new Error("The isolated runner stopped before returning evidence."),
        );
    });
  });
}
