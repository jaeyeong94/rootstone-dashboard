/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("path");
const dotenv = require("dotenv");

const envPaths = [".env", ".env.local", ".env.production"];
for (const envPath of envPaths) {
  dotenv.config({ path: path.resolve(__dirname, envPath), override: false });
}

module.exports = {
  apps: [
    {
      name: "rootstone-dashboard",
      script: ".next/standalone/server.js",
      cwd: __dirname,
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        ...process.env,
        NODE_ENV: "production",
        HOSTNAME: "0.0.0.0",
        PORT: process.env.PORT || "3000",
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "/tmp/rootstone-dashboard-error.log",
      out_file: "/tmp/rootstone-dashboard-out.log",
      merge_logs: true,
    },
  ],
};
