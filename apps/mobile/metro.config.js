const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the monorepo root so Metro can resolve packages hoisted there
config.watchFolders = [workspaceRoot];

// Prefer local node_modules first, fall back to root workspace node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// App source imports `react-native` → shim that wraps Text/TextInput with Nunito (real RN uses getters; cannot assign RN.Text).
// `react-native-internal` bypasses the shim so the shim can require the real package.
// Delegate fallbacks with `context.resolveRequest` — `config.resolver.resolveRequest` is often undefined on getDefaultConfig().
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'mapbox-gl/dist/mapbox-gl.css') {
    return { type: 'empty' };
  }
  if (moduleName === 'react-native-internal') {
    return context.resolveRequest(context, 'react-native', platform);
  }
  if (moduleName === 'react-native') {
    const origin = context.originModulePath ?? '';
    const inNodeModules = origin.includes('node_modules');
    const fromFontShim = origin.includes('reactNativeWithAppFont');
    if (!inNodeModules && !fromFontShim) {
      return {
        filePath: path.join(projectRoot, 'lib/reactNativeWithAppFont.js'),
        type: 'sourceFile',
      };
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
