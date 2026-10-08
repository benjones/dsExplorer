# DS Explorer

A small, client-only TypeScript web-components app.

## Local development

This project has no build system or package manager. TypeScript is compiled directly with the `tsc` installed on your machine.

For a one-time compile and local server:

```sh
tsc --project tsconfig.json
cp index.html dist/index.html
python3 -m http.server --directory dist
```

For development, use the included launcher:

```sh
./serve.py
```

It performs the initial compile, starts `tsc --watch` in a child process, and serves `dist/` at `http://localhost:8000`. Use `./serve.py --port 3000` to choose a different port. Press `Ctrl-C` to stop both processes.

The server has the standard `http.server` behavior and does not add live browser reloads; refresh the browser after TypeScript recompiles. Restart `serve.py` after changing `index.html`, so it is copied to `dist/` again.

Source files live in `src/`; `src/main.ts` registers the `<ds-explorer>` component. TypeScript uses native ES modules, so imports include the emitted `.js` extension.

## Deployment

Pushing to `main` triggers `.github/workflows/deploy-pages.yml`. In the repository's **Settings → Pages**, set the source to **GitHub Actions**. The workflow calls `tsc` directly, copies `index.html` to the deployment artifact, and deploys `dist/`. It therefore expects the GitHub-hosted runner to provide `tsc`; no Node project, npm command, lockfile, bundler, or build system is used.
