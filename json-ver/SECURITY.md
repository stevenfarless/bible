# Security Policy

## Supported Versions

The current deployed version of the app (latest commit on `main`) is the only supported version. Older commits are not patched.

## Reporting a Vulnerability

Do not open a public GitHub issue for security vulnerabilities.

Instead, use [GitHub Private Security Advisories](https://github.com/stevenfarless/esv-bible/security/advisories/new) to report a vulnerability privately. This keeps the details confidential until a fix is in place.

**Please include:**
- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof of concept
- Any relevant file paths, line numbers, or network requests

**Response timeline:** Acknowledgement within 7 days. Fixes are prioritized based on severity.

## Scope

Areas of particular concern for this project:

- Firebase Realtime Database Security Rules allowing unauthenticated access
- Accidental commits of the ESV API key or Firebase credentials — report immediately so the key can be rotated
- Content Security Policy gaps that allow XSS

## Out of Scope

- The Firebase client config (`firebase-config.js`) is intentionally public. Firebase API keys for web apps are not secrets — access is controlled entirely by Security Rules and Firebase Auth, not by keeping the key private. See [Firebase docs](https://firebase.google.com/docs/projects/api-keys) for details.
