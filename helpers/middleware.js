import { verifyPostingToken, verifyAuthToken } from './token';
import { getAppProfile } from './utils';

const client = require('./client');
const config = require('../config.json');
const jwt = require('jsonwebtoken');
const lodash = require('lodash');

/**
 * Check if user allow app proxy account to post on his behalf
 * And if app allow @hivesigner to post on his behalf
 */
export const verifyPermissions = (roles) =>  async (req, res, next) => {
  const role = Array.isArray(roles) && req.role && roles.includes(req.role)
    ? req.role : roles;

  let accounts;
  try {
    accounts = await client.database.getAccounts([req.user]);
  } catch (e) {
    console.error('Unable to load accounts from hived', req.proxy, req.user, e);
  }

  let error = null;
  if (!lodash.has(accounts, '[0].name')) {
    error = `The app @${req.proxy} or user @${req.user} account failed to load`;
  } else {
    if (req.email) {
      try {
        const jsonData = JSON.parse(accounts[0].json_metadata)
        if (jsonData.hive_sso.email !== req.email) {
          error = `Access token doesn't have permission to broadcast for @${req.user}`;
        } else {
          if (role !== 'auth') {
            const postingData = JSON.parse(accounts[0].posting_json_metadata)
            if (postingData.hive_sso.authorized_apps[req.proxy] > req.token_generated_at) {
              error = `Access token doesn't have permission to broadcast for @${req.user}`;
            }

            if (role === 'code') {
              const profile = await getAppProfile(req.body.app);
              if (profile.error) {
                error = profile.error;
              } else {
                try {
                  jwt.verify(profile.secret, req.secret)
                } catch(e) {
                  error = 'Invalid app secret';
                }
              }
            }
          }
        }
      }
      catch(e) {
        error = `Access token doesn't have permission to broadcast for @${req.user}`;
      }
    }

    const userAccountAuths = accounts[0].posting.account_auths.map((account) => account[0]);
    if (userAccountAuths.indexOf(process.env.BROADCASTER_USERNAME) === -1) {
      error = `Broadcaster account doesn't have permission to broadcast for @${req.user}`;
    }
  }

  if (error) {
    console.error(error);
    res.status(401).json({
      error: 'unauthorized_client',
      error_description: error,
    });
  } else {
    next();
  };
};

export const strategy = (req, _res, next) => {
  let authorization = req.get('authorization');
  if (authorization) authorization = authorization.replace(/^(Bearer|Basic)\s/, '').trim();
  const token = authorization
    || req.query.access_token
    || req.body.access_token
    || req.query.code
    || req.body.code
    || req.query.refresh_token
    || req.body.refresh_token;

  if (token) {
    try {
      const dtoken=jwt.decode(token);
      if(!dtoken){
        next();
      }
      const data = JSON.parse(dtoken.data)
      let decoded = null;
      if (data.email) {
        decoded = data.role === 'auth' ? verifyAuthToken(token) : verifyPostingToken(token);
      } else {
        decoded = JSON.parse(jwt.verify(token, process.env.JWT_POSTING_SECRET_KEY).data);
      }
      if (decoded) {
        /* eslint-disable no-param-reassign */
        req.role = decoded.role || 'posting';
        req.email = decoded.email;

        if (decoded.role === 'auth') {
          req.scope = ['auth'];
          req.proxy = req.body.app;
          req.user = req.body.username;
        } else {
          if (decoded.role === 'code') {
            req.secret = req.body.secret;
          }
          req.user = decoded.username;
          req.scope = config.authorized_operations;
          req.token_generated_at = decoded.timestamp;
          req.proxy = decoded.app || 'dapplr';
        }
        /* eslint-enable no-param-reassign */
        next();
      } else {
        next();
      }
    } catch (e) {
      console.log(new Date().toISOString(), 'Access Token decoding failed', e);
      next();
    }
  } else {
    next();
  }
};

export const authenticate = (roles) => async (req, res, next) => {
  const role = Array.isArray(roles) && req.role && roles.includes(req.role)
    ? req.role : roles;

  if (!req.role || (role && req.role !== role)) {
    res.status(401).json({
      error: 'invalid_grant',
      error_description: 'The token has invalid role',
    });
  } else {
    next();
  }
};
