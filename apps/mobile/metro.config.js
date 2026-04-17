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

// Stub out @rnmapbox/maps on web — it requires mapbox-gl CSS which isn't installed
// The app is mobile-only; web is used only for Expo dev server
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'mapbox-gl/dist/mapbox-gl.css') {
    return { type: 'empty' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
