// pm2 process definition for the VeriMind API on the Oracle VM.
// pm2 keeps it running, restarts it on crashes and starts it again after a reboot.
const path = require('node:path');

module.exports = {
  apps: [
    {
      name: 'verimind-api',
      cwd: path.join(__dirname, '..', '..', 'backend'),
      script: 'src/server.js',
      env: { NODE_ENV: 'production', PORT: '8080' },
      instances: 1, // one process: the model is loaded once into RAM
      autorestart: true,
      kill_timeout: 15000, // let the server close connections cleanly
      restart_delay: 5000,
      time: true, // timestamps in `pm2 logs`
    },
  ],
};
