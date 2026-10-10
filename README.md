# Emberkeep Relay

Same-origin bridge for Emberkeep Ultimate's KindleHub API and encrypted state requests.

## Run

`npm start` starts `server.cjs`. Render provides `PORT`; the relay binds to `0.0.0.0` by default. Configure `UPSTREAM_API`, `UPSTREAM_STATE`, `SPOOF_ORIGIN` in the deployment environment. CORS is open to all origins and does not allow credentialed cookies. Keep secrets out of this repository.

`/api/*` forwards to the API gateway's `/rest/v1/*` endpoints, including shorthand `/api/rpc/*` calls. `/state` forwards to the state gateway. `/__health` reports process health only.
