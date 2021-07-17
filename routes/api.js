import {
  Router
} from 'express';
import {
  PrivateKey,
  Client
} from '@hiveio/dhive';
import {
  authenticate,
  verifyPermissions
} from '../helpers/middleware';
import {
  getErrorMessage,
  isOperationAuthor
} from '../helpers/utils';
import {
  issue
} from '../helpers/token';
import client from '../helpers/client';
import cjson from '../config.json';

const {
  authorized_operations,
  token_expiration
} = cjson;

const router = Router();
const privateKey = PrivateKey.fromString(process.env.BROADCASTER_POSTING_WIF);

//const client = new Client('https://api.hive.blog');

/** Get my account details */
router.all('/me', authenticate(), async (req, res) => {
  const scope = req.scope.length ? req.scope : authorized_operations;
  let accounts;
  try {
    accounts = await client.database.getAccounts([req.user]);
  } catch (err) {
    console.error(`Get account @${req.user} failed`, err);
    return res.status(501).json({
      error: 'server_error',
      error_description: 'Request to hived API failed',
    });
  }

  let metadata;
  if (accounts[0] && accounts[0].posting_json_metadata) {
    try {
      metadata = JSON.parse(accounts[0].posting_json_metadata);
      if (!metadata.profile || !metadata.profile.version) {
        metadata = {};
      }
    } catch (e) {
      console.error(`Error parsing account posting_json ${req.user}`, e); // error in parsing
      metadata = {};
    }
  }
  // otherwise, fall back to reading from `json_metadata`
  if (accounts[0] && accounts[0].json_metadata && (!metadata || !metadata.profile)) {
    try {
      metadata = JSON.parse(accounts[0].json_metadata);
    } catch (error) {
      console.error(`Error parsing account json ${req.user}`, error); // error in parsing
      metadata = {};
    }
  }

  return res.json({
    user: req.user,
    _id: req.user,
    name: req.user,
    account: accounts[0],
    scope,
    user_metadata: metadata,
  });
});

//Get Follower



/** Broadcast transaction */
router.post('/broadcast', authenticate('app'), verifyPermissions, async (req, res) => {
  const scope = req.scope.length ? req.scope : authorized_operations;
  const {
    operations
  } = req.body;

  let scopeIsValid = true;
  let requestIsValid = true;
  let invalidScopes = '';
  operations.forEach((operation) => {
    /** Check if operation is allowed */
    if (scope.indexOf(operation[0]) === -1) {
      scopeIsValid = false;
      invalidScopes += (invalidScopes !== '' ? ', ' : '') + operation[0];
    }
    /** Check if author of the operation is user */
    if (!isOperationAuthor(operation[0], operation[1], req.user)) {
      requestIsValid = false;
    }
    if (
      operation[0] === 'account_update2' &&
      (operation[1].owner || operation[1].active || operation[1].posting)
    ) {
      requestIsValid = false;
    }
    if (operation[0] === 'custom_json') {
      if (!('required_auths' in operation[1])) {
        operation[1].required_auths = [];
      }
      if (!('required_posting_auths' in operation[1])) {
        operation[1].required_posting_auths = [];
      }
    }
    if (operation[1].__config || operation[1].__rshares) {
      delete operation[1].__config;
      delete operation[1].__rshares;
    }
  });

  if (!scopeIsValid) {
    res.status(401).json({
      error: 'invalid_scope',
      error_description: `The access_token scope does not allow the following operation(s): ${invalidScopes}`,
    });
  } else if (!requestIsValid) {
    res.status(401).json({
      error: 'unauthorized_client',
      error_description: `This access_token allow you to broadcast transaction only for the account @${req.user}`,
    });
  } else {
    client.broadcast.sendOperations(operations, privateKey)
      .then(
        (result) => {
          console.log(new Date().toISOString(), client.currentAddress, `Broadcasted: success for @${req.user} from app @${req.proxy}`);
          res.json({
            result
          });
        },
        (err) => {
          console.log(
            new Date().toISOString(), client.currentAddress, operations.toString(),
            `Broadcasted: failed for @${req.user} from app @${req.proxy}`,
            JSON.stringify(req.body),
            JSON.stringify(err),
          );
          res.status(500).json({
            error: 'server_error',
            error_description: getErrorMessage(err) || err.message || err,
            response: err,
          });
        },
      );
  }
});

//Get Posts
//Query for the most recent posts having a specific tag, using a Hive filter
// {
//   "filters": "trending", such as hot, created, promoted
//   "query":{
//       "tag":"hiveio",
//       "limit": 5
//   }
// }
router.post('/get_posts_by_filters', authenticate(), async (req, res) => {
  const scope = req.scope.length ? req.scope : authorized_operations;
  const filters = req.body.filters;
  const query = req.body.query;
  client.database
    .getDiscussions(filters, query)
    .then(result => {
      var posts = [];
      result.forEach(post => {
        const json = JSON.parse(post.json_metadata);
        const image = json.image ? json.image[0] : '';
        const title = post.title;
        const author = post.author;
        const created = new Date(post.created).toDateString();
        posts.push({
          title,
          author,
          image,
          created
        });
      });

      return res.json(result);
    })
    .catch(err => {
      console.log(
        new Date().toISOString(), client.currentAddress, filters,
        `Broadcasted: failed for @${req.user} from app @${req.proxy}`,
        JSON.stringify(req.body),
        JSON.stringify(err),
      );
      res.status(500).json({
        error: 'server_error',
        error_description: getErrorMessage(err) || err.message || err,
        response: err,
      });
    });
});

//Get Post
//get_content of the post
router.post('/get_content', authenticate(), async (req, res) => {
  const scope = req.scope.length ? req.scope : authorized_operations;
  const author = req.body.author;
  const permlink = req.body.permlink;
  client.database
    .call('get_content', [author, permlink])
    .then(result => {
      var post = {};
      const json = JSON.parse(result.json_metadata);
      const image = json.image ? json.image[0] : '';
      const title = result.title;
      const body = result.body;
      const author = result.author;
      const net_votes = result.net_votes;
      const created = new Date(result.created).toDateString();
      post = {
        title,
        body,
        author,
        net_votes,
        image,
        created
      };
      return res.json(post);
    })
    .catch(err => {
      console.log(
        new Date().toISOString(), client.currentAddress, scope,
        `Broadcasted: failed for @${req.user} from app @${req.proxy}`,
        JSON.stringify(req.body),
        JSON.stringify(err),
      );
      res.status(500).json({
        error: 'server_error',
        error_description: getErrorMessage(err) || err.message || err,
        response: err,
      });
    });
});


//Get Post Comments
//get_content_replies of the selected post
router.post('/get_posts_comments', authenticate(), async (req, res) => {
  const scope = req.scope.length ? req.scope : authorized_operations;
  const author = req.body.author;
  const permlink = req.body.permlink;
  client.database
    .call('get_content_replies', [author, permlink])
    .then(result => {
      var comments = [];
      result.forEach(post => {
        const json = JSON.parse(post.json_metadata);
        const image = json.image ? json.image[0] : '';
        const title = post.title;
        const body = post.body;
        const author = post.author;
        const net_votes = post.net_votes;
        const created = new Date(post.created).toDateString();
        comments.push({
          title,
          body,
          author,
          net_votes,
          image,
          created
        });
      });
      return res.json(comments);
    })
    .catch(err => {
      console.log(
        new Date().toISOString(), client.currentAddress, scope,
        `Broadcasted: failed for @${req.user} from app @${req.proxy}`,
        JSON.stringify(req.body),
        JSON.stringify(err),
      );
      res.status(500).json({
        error: 'server_error',
        error_description: getErrorMessage(err) || err.message || err,
        response: err,
      });
    });
});


//Get Account Comments
router.post('/get_account_posts', authenticate(), async (req, res) => {
  const scope = req.scope.length ? req.scope : authorized_operations;
  const author = req.body.author;
  const {
    operations
  } = req.body;
  client.hivemind.call('get_account_posts', {
      sort: 'comments',
      account: author,
      limit: 100
    })
    // work with state object
    .then(result => {
      console.log(result);
      if (
        !(
          Object.keys(result).length === 0 &&
          result.constructor === Object
        )
      ) {
        var comments = [];
        Object.keys(result).forEach(key => {
          const comment = result[key];
          const parent_author = comment.parent_author;
          const parent_permlink = comment.parent_permlink;
          const created = new Date(comment.created).toDateString();
          const body = md.render(comment.body);
          const totalVotes = comment.stats.total_votes;
          comments.push({
            comment,
            parent_author,
            parent_permlink,
            created,
            body,
            totalVotes
          });
        });
        return res.json(comments);
      }
    })
    .catch(err => {
      console.log(
        new Date().toISOString(), client.currentAddress, operations,
        `Broadcasted: failed for @${req.user} from app @${req.proxy}`,
        JSON.stringify(req.body),
        JSON.stringify(err),
      );
      res.status(500).json({
        error: 'server_error',
        error_description: getErrorMessage(err) || err.message || err,
        response: err,
      });
    });

});


//Submit Post
//Fetch Hive Post or Comment data
/* {
  "username":"telsacoin",
  "title":"telsacoin",
  "body":"telsacoin",
  "tags":"telsacoin",
  "postingKey":"xxx"
} */

//reslut
/* {
  "id": "e420c44fa2da348a2c7783f4551dff1dc62865ff",
  "block_num": 55699257,
  "trx_num": 5,
  "expired": false
} */
router.post('/submit_post', authenticate(), async (req, res) => {
  const scope = req.scope.length ? req.scope : authorized_operations;
  const {
    operations
  } = req.body;
  //get private key
  const privateKey = PrivateKey.fromString(
    req.body.postingKey
  );
  //get account name
  const account = req.body.username;
  //get title
  const title = req.body.title;
  //get body
  const body = req.body.body;
  //get tags and convert to array list
  const tags = req.body.tags;
  const taglist = tags.split(' ');
  //make simple json metadata including only tags
  const json_metadata = JSON.stringify({
    tags: taglist
  });
  //generate random permanent link for post
  const permlink = Math.random()
    .toString(36)
    .substring(2);
  //broadcast post to the author
  client.broadcast
    .comment({
        author: account,
        body: body,
        json_metadata: json_metadata,
        parent_author: '',
        parent_permlink: taglist[0],
        permlink: permlink,
        title: title,
      },
      privateKey
    )
    .then(result => {
      var post = {};
      const id = result.id
      const block_num = result.block_num;
      const trx_num = result.trx_num;
      const expired = result.expired;
      const postLink = taglist[0] + '/@' + account + '/' + permlink;
      post = {
        id,
        title,
        body,
        tags,
        trx_num,
        block_num,
        expired,
        postLink
      };
      return res.json(result);
    })
    .catch(err => {
      console.log(
        new Date().toISOString(), client.currentAddress, operations,
        `Broadcasted: failed for @${req.user} from app @${req.proxy}`,
        JSON.stringify(req.body),
        JSON.stringify(err),
      );
      res.status(500).json({
        error: 'server_error',
        error_description: getErrorMessage(err) || err.message || err,
        response: err,
      });
    });
});


//Submit Comment Reply



//Blog Feed
//How to fetch most recent five posts from particular user on Hive.
// {
//   "tag": "hiveio",
//   "limit": 5 
// }
router.post('/get_discussions_by_user', authenticate(), async (req, res) => {
  const scope = req.scope.length ? req.scope : authorized_operations;
  const {
    operations
  } = req.body;
  client.database
    .getDiscussions('blog', req.body)
    .then(result => {
      var posts = [];
      result.forEach(post => {
        const json = JSON.parse(post.json_metadata);
        const image = json.image ? json.image[0] : '';
        const title = post.title;
        const body = post.body;
        const tags = json.tags ? json.tags : '';
        const author = post.author;
        const created = new Date(post.created).toDateString();
        posts.push({
          title,
          body,
          tags,
          author,
          image,
          created
        });
      });

      return res.json(result);
    })
    .catch(err => {
      console.log(
        new Date().toISOString(), client.currentAddress, operations,
        `Broadcasted: failed for @${req.user} from app @${req.proxy}`,
        JSON.stringify(req.body),
        JSON.stringify(err),
      );
      res.status(500).json({
        error: 'server_error',
        error_description: getErrorMessage(err) || err.message || err,
        response: err,
      });
    });
});

/** Request app access token */
router.all('/oauth2/token', authenticate(['code', 'refresh']), async (req, res) => {
  console.log(new Date().toISOString(), client.currentAddress, `Issue tokens for user @${req.user} for @${req.proxy} app.`);
  res.json({
    access_token: issue(req.proxy, req.user, 'posting'),
    refresh_token: issue(req.proxy, req.user, 'refresh'),
    expires_in: token_expiration,
    username: req.user,
  });
});

/** Revoke access token */
router.all('/oauth2/token/revoke', authenticate('app'), async (req, res) => {
  res.json({
    success: true
  });
});

export default router;
