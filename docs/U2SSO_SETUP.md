# U2SSO Setup for Standup Bot

This document describes how to run the full U2SSO PoC and integrate it with the standup bot demo.

## U2SSO PoC (Go)

**Source:** [BoquilaID/U2SSO](https://github.com/BoquilaID/U2SSO)

### Dependencies

- Go 1.22+
- Node.js v18.20.4+
- Truffle v5.11.5+
- Ganache v7.9.1+
- Web3.js v1.10.0+
- Solidity v0.5.16+ (solc-js)

### Quick Start

1. **Clone U2SSO**
   ```bash
   git clone https://github.com/BoquilaID/U2SSO.git
   cd U2SSO/proof-of-concept
   ```

2. **Start Ganache**
   ```bash
   # Run Ganache (default: http://127.0.0.1:7545)
   ./ganache-2.7.1-linux-x86_64.AppImage  # or your Ganache executable
   ```

3. **Deploy contract**
   ```bash
   cd u2ssoContract
   truffle compile
   truffle test
   truffle deploy
   # Note the contract address, e.g. 0xFf9e0936C2d65D66E9e66d3b1467982C9bfA0e45
   ```

4. **Run U2SSO server**
   ```bash
   cd ..
   go build server.go
   ./server -contract <CONTRACT_ADDRESS>
   # Server runs at http://localhost:8080
   ```

5. **Create and register identities (clientapp)**
   ```bash
   go build clientapp.go
   ./clientapp -command create -contract <CONTRACT> -keypath key1.txt -ethkey <ETH_PRIVATE_KEY>
   ./clientapp -command load -contract <CONTRACT> -keypath key1.txt
   # For signup: copy challenge and sname from http://localhost:8080/directSignup
   ./clientapp -command register -contract <CONTRACT> -keypath key1.txt -sname <SNAME> -challenge <CHALLENGE>
   # For login: copy challenge and sname from http://localhost:8080/directLogin
   ./clientapp -command auth -contract <CONTRACT> -keypath key1.txt -sname <SNAME> -challenge <CHALLENGE>
   ```

## Standup Bot Integration

The demo app (`demo_app/app.py`) runs in **mock mode** by default: it accepts valid-form requests without calling the U2SSO server. This allows rapid iteration and testing.

### Mock Mode (Default)

- No Ganache, Go, or U2SSO required
- Nullifier replay rejection is enforced
- Use placeholder hex values for spk, proof, nullifier, signature

### U2SSO Mode (Future)

To wire the demo app to the real U2SSO server:

1. Run U2SSO server on port 8080 (or configure URL)
2. Set `U2SSO_SERVER_URL=http://localhost:8080` in environment
3. Update `AuthVerifier` to call U2SSO HTTP endpoints instead of mock logic
4. Users must run `clientapp` to generate proofs before signup/login

### Nullifier Enforcement

The U2SSO PoC server has a TODO for nullifier enforcement. Our `identity_core.NullifierStore` adds verifier-scoped replay rejection. When integrating with U2SSO:

- Option A: Add nullifier checks in our Python layer (proxy to U2SSO, then check nullifier)
- Option B: Patch U2SSO server to enforce nullifiers before accepting registration
