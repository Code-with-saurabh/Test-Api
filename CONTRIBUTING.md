# Contributing to TestApi

Thanks for helping improve TestApi. This project welcomes issues and pull requests.

## Development setup

```bash
git clone https://github.com/Code-with-saurabh/Test-Api.git
cd Test-Api
npm install
npm run dev
```

## Before opening a pull request

Run all quality gates:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Please keep the following in mind:

- TypeScript is strict. Avoid `any` unless there is no alternative.
- Keep the renderer free of Node.js APIs. All privileged work goes through typed IPC.
- Add or update Vitest tests for shared logic and bug fixes.
- Keep UI changes consistent with the existing dark/light theme and Tailwind tokens.
- Do not commit `node_modules/`, `out/`, `release/`, installers or secrets.
- Update `README.md` / `docs/INSTALLATION.md` when behaviour or setup changes.

## Commit style

Use short, descriptive messages, for example:

- `feat: add zoom HUD and status-bar controls`
- `fix: persist editor font size across restarts`
- `docs: clarify unsigned macOS install steps`

## Reporting bugs

Open an issue at https://github.com/Code-with-saurabh/Test-Api/issues and include:

- OS and version
- TestApi version (Settings → About)
- Steps to reproduce
- Expected vs actual behaviour
- Screenshots or logs if helpful

## Security

Please do not open public issues for security vulnerabilities. Email **saurabhsharma12166@gmail.com** instead.

## License

By contributing you agree that your changes are released under the MIT License.
