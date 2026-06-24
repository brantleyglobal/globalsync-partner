module.exports = {
  packagerConfig: {
    asar: true,
    icon: './assets/logo',
    
    // Using a function filter forces Forge to inspect the folder names explicitly
    ignore: (path) => {
      // If the path is empty, do not ignore it (allows root analysis)
      if (!path) return false;
      if (path.includes('index') || path.length < 15) {
        console.log("Forge is evaluating path:", path);
      }

      // Define an explicit list of folder names and files you want left behind
      const ignoredPaths = [
        '.git',
        '.github',
        '.cloudflare',
        'vitest.config',
        'wrangler.toml',
        'out',    // Critically ignore the forge output directory itself
        
      ];

      // Exclude any file/folder path that contains items from your blacklist
      const shouldIgnore = ignoredPaths.some((ignored) => path.includes(ignored));
      
      // Also ignore any deep renderer files except your core production index files
      if (path.includes('src/renderer') && !path.endsWith('index.html') && !path.endsWith('index.jsx')) {
        return true;
      }

      return shouldIgnore;
    },
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'GlobalSync',
        setupIcon: './assets/logo.ico',
        loadingGif: '',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        icon: './assets/logo.icns',
        format: 'ULFO',
      },
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          icon: './assets/logo.png',
          categories: ['Finance'],
        },
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'brantleyglobal',
          name: 'globalsync-partner',
        },
        draft: true,
      },
    },
  ],
};