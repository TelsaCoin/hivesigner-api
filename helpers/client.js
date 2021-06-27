import { Client } from '@hiveio/dhive';

const DEFAULT_SERVER = [
  process.env.BROADCAST_URL,
  'https://api.hive.blog',
  'https://api.deathwing.me'
];

const client = new Client(DEFAULT_SERVER, {
  timeout: 3000,
  failoverThreshold: 15,
  consoleOnFailover: true
});

export default client;
module.exports = client;
