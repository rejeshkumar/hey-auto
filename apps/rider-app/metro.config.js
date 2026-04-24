const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the app folder only — not the whole monorepo
config.watchFolders = [projectRoot];

// Resolve modules from the app's own node_modules first, then monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Ensure the project root is the app directory, not the monorepo root
config.projectRoot = projectRoot;

module.exports = config;
