import { posting_token_expiration, auth_token_expiration } from '../config.json';
const jwt = require('jsonwebtoken');
const { promisify } = require("util");
const redis = require("redis");
const redisClient = redis.createClient({ url: process.env.USERS_REDIS_URL });
const redisGet = promisify(redisClient.get).bind(redisClient);
const redisSet = promisify(redisClient.set).bind(redisClient);

export const issuePostingToken = async (app, username, email) => {
  const timestamp = parseInt(new Date().getTime() / 1000, 10)
  const data = {
    username: username,
    app: app,
    role: 'posting',
    email: email,
    timestamp: timestamp,
  };

  const exp = timestamp + posting_token_expiration;
  const token = jwt.sign({ data: JSON.stringify(data), exp: exp }, process.env.JWT_POSTING_SECRET_KEY)
  return { token: token, exp: exp };
};

export const issuePostingCode = async (app, username, email) => {
  await redisSet(email, username);

  const timestamp = parseInt(new Date().getTime() / 1000, 10)
  const data = {
    username: username,
    app: app,
    role: 'code',
    email: email,
    timestamp: timestamp,
  };

  const exp = timestamp + posting_token_expiration;
  const token = jwt.sign({ data: JSON.stringify(data), exp: exp }, process.env.JWT_POSTING_SECRET_KEY)
  return { code: token, exp: exp };
};

// eslint-disable-next-line consistent-return
export const verifyPostingToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_POSTING_SECRET_KEY);
    const userData = JSON.parse(decoded.data);
    return userData;
  }
  catch(e) {
    console.error(e);
    return null;
  };
};

export const issueAuthToken = async (email, remoteAddress) => {
  const timestamp = parseInt(new Date().getTime() / 1000, 10)
  const data = {
    email: email,
    role: 'auth',
    app: 'hive_sso',
    address: remoteAddress,
    timestamp: timestamp
  }
  const username = await redisGet(email);
  const exp = timestamp + auth_token_expiration;
  const token = jwt.sign({ data: JSON.stringify(data), exp: exp }, process.env.JWT_LOGIN_SECRET_KEY)
  return { token: token, exp: exp, user: username };
};

// eslint-disable-next-line consistent-return
export const verifyAuthToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_LOGIN_SECRET_KEY);
    const userData = JSON.parse(decoded.data);
    return userData;
  }
  catch(e) {
    console.error(e);
    return null;
  };
};
