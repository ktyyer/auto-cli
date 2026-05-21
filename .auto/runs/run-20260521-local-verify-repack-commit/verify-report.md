# VerifyReport · run-20260521-local-verify-repack-commit

## verify
- `analysis`: pass
- `lint`: pass
- `regression`: pass
- `package`: pass
- `install-smoke`: pass
- `run-completeness`: pass

## commands
- command: `npm run check`
  - result: PASS
- command: `npm run uninstall`
  - result: PASS
- command: `npm run pack`
  - result: PASS
- command: `.\install-from-tgz.bat`
  - result: PASS
- command: `node scripts/validate-run-completeness.js --run run-20260521-local-verify-repack-commit`
  - result: PASS
