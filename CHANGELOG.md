# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0/).

## [Unreleased]

## [0.3.2] - 2026-11-17

### Fixed

- `dead` accepts `deadOnly` without `destructiveManifest` again; it has no effect without a manifest, as in the pre-extraction `apx` plugin
- The human dead-code report reproduces oclif's `ux.table` layout (box-drawn borders, Title Case headers, a blank line after each table) and no longer indents binding-source rows

### Security

- Resolved high-severity Dependabot alerts in the `minimatch` dependency used by `typescript-estree`

## [0.3.1] - 2026-10-01

### Fixed

- Restored CLI parity for `apx dead` command with `--dead-only` flag and `ux.table` report layout

## [0.3.0] - 2026-10-01

### Added

- Command use cases with previews and pure renderers

## [0.2.0] - 2026-09-30

### Added

- AEP code generation and dead-code analysis capabilities

## [0.1.0] - 2026-09-30

### Changed

- Internal maintenance and tooling updates
