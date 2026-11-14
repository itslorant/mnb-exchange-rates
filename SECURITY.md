# Security policy

## Supported versions

Only the latest released version receives fixes. While the package is below
1.0.0, that means the most recent `0.x` release.

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Report it privately through GitHub: open the repository's **Security** tab and
choose **Report a vulnerability**. That creates a private advisory that only
you and the maintainer can see.

Include what you can of:

- the affected version,
- what the problem is and what an attacker could do with it,
- steps or a small example that reproduces it.

This is a one-person, spare-time project, so there is no guaranteed response
time. The aim is to acknowledge a report within a week and to publish a fix and
an advisory once it is resolved. You will be credited unless you prefer not to
be.

## What is in scope

- Flaws in how the client builds requests, parses responses or handles errors
  (for example XML parsing issues, injection through arguments, or unbounded
  resource use on malformed responses).
- Vulnerabilities in this package's own dependencies that affect its users.

## What is not

- Problems in the MNB service itself. Report those to the
  [Magyar Nemzeti Bank](https://www.mnb.hu).
- The fact that the MNB service answers SOAP requests over plain HTTP only.
  That is a limitation of the service, documented in the README, and not
  something this package can change. The endpoint is configurable for anyone who
  routes requests through a trusted proxy.

## Dependencies

The package has a single runtime dependency, `fast-xml-parser`. Dependency
updates are proposed automatically by Renovate, and new releases wait seven
days before being proposed.
