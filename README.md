# apx-core

Shared apx engine: the Apex Enterprise Patterns (AEP) code generators and
dead-code analysis behind the [`apx`](https://github.com/Syntax-Syllogism/apx)
Salesforce CLI plugin and the Apx VS Code extension.

apx-core is a plain Node/TypeScript library with no CLI framework dependency.
Call its functions directly from a script, an editor extension, a CI job, or
any other Node codebase.

> **Status:** early. This release sets up the package and its error contract;
> the generators and analysis move in over the next minor releases.

## Install

```bash
npm install @syntax-syllogism/apx-core
```

Requires Node.js 22 or later.

## API

| Export | Purpose |
| --- | --- |
| `ApxError` | Base class for every error apx-core throws on purpose. Carries a stable `code`, optional structured `data`, and a default English `message`. |
| `isApxError(error)` | Structural type guard for `ApxError`; safe across duplicate copies of this package. |

```ts
import { isApxError } from '@syntax-syllogism/apx-core';

try {
  // call an apx-core function
} catch (error) {
  if (isApxError(error)) {
    console.error(`${error.code}: ${error.message}`);
  } else {
    throw error;
  }
}
```

## Errors

Errors are reported as `ApxError` instances (or area-specific subclasses).
The `code` and the shape of `data` are part of the public API; the `message`
text is not and may be reworded in any release.

No error codes are thrown yet.

## Versioning

apx-core follows [Semantic Versioning](https://semver.org/). Removing or
renaming an export, changing a signature or result shape, changing an error
`code`, changing a generated file's content or path, or rejecting input that
was previously valid is a major change. Consumers should pin an exact version
and upgrade deliberately.

## Development

```bash
npm install
npm run build
npm test          # typecheck, lint, prettier, mocha + coverage
npm run pack:check
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Security

See [SECURITY.md](SECURITY.md) for how to report vulnerabilities.

## License

[MIT](LICENSE) © Jake Richter
