/** @type {import('dependency-cruiser').IConfiguration} */
// @ts-nocheck

module.exports = {
  forbidden: [
    {
      name: 'no-src-imports-electron',
      comment: 'Renderer (src/) must not import electron main-process modules — use window.jarvisBridge / global.d.ts',
      severity: 'error',
      from: { path: '^src/' },
      to: { path: '^electron/' },
    },
    {
      name: 'no-employees-from-main',
      comment: 'Employee/gateway/harness modules must not import main.ts (bootstrap stays thin)',
      severity: 'error',
      from: { path: '^electron/(employees|gateway|harness)/' },
      to: { path: 'main\\.ts$' },
    },
    {
      name: 'no-circular',
      comment: 'No dependency cycles between modules',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-ipc-register-from-renderer-paths',
      comment: 'register-* IPC modules are main-only',
      severity: 'error',
      from: { path: '^src/' },
      to: { path: 'electron/ipc/register-' },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    exclude: {
      path: '(^dist-electron|^dist/|\\.test\\.(ts|tsx)$|\\.spec\\.(ts|tsx)$)',
    },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
};
