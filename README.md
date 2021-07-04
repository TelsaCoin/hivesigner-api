# DTOK Posting API

A Node.js application over hivesigner for the Hive blockchain. Check it out on [www.telsacoin.io](https://www.telsacoin.io)

# API

### Generate access token from code received after sign in

```
TYPE - Post
URL - https://api.telsacoin.io/api/aouth2/token
PARAMS - { "code": `access code`, "secret": `app secret`}
```

### All other API's are hivesigner compatiable. Just replace the URL to api.hivesso.com and the access token. Rest is just same.

# Usage

### Server

```
# Install dependencies
npm install

# Serve on localhost:3000
npm run start

# Build for production
npm run build
```

# Configuration

To configure the server you can use environment variables or a `.env` file. Use `env.example` as a reference configuration.

```
# hive user name for broadcasting account
BROADCASTER_USERNAME=username
# hive posting key for broadcasting account
BROADCASTER_POSTING_WIF=5JRPH...
# secret key to sign and verify posting access code and access token
```
