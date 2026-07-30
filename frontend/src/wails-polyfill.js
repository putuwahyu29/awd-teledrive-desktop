// Polyfill & Bridge for running Awd TeleDrive in Web Browsers / Headless Web Server mode
window.isWebMode = !window.runtime;

if (!window['go']) {
  window['go'] = {
    main: {
      App: new Proxy({}, {
        get(target, prop) {
          return async (...args) => {
            const methodName = String(prop);

            // Handle Desktop-only Native Dialog methods gracefully in Web mode
            if (methodName.includes('Dialog') || methodName === 'SelectFolder') {
              alert('⚠️ Fitur dialog berkas native OS ini hanya tersedia di Aplikasi Desktop GUI.\n\nUntuk Web Mode, silakan gunakan antarmuka web.');
              return null;
            }

            try {
              let apiKey = localStorage.getItem('api_key') || '';
              let res = await fetch('/api/' + methodName, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': 'Bearer ' + apiKey
                },
                body: JSON.stringify(args)
              });

              if (res.status === 401) {
                const userKey = prompt('🔒 Awd TeleDrive Server dilindungi kunci keamanan.\n\nMasukkan API Key / Password server Anda:');
                if (userKey) {
                  localStorage.setItem('api_key', userKey.trim());
                  // Retry request with newly saved API key
                  return await window['go']['main']['App'][prop](...args);
                }
              }

              if (!res.ok) {
                res = await fetch('/api/' + methodName, {
                  headers: {
                    'Authorization': 'Bearer ' + apiKey
                  }
                });
              }
              if (res.ok) {
                const data = await res.json();
                return data;
              }
            } catch (e) {
              console.warn('Wails Web Proxy API call fallback error for ' + methodName + ':', e);
            }

            if (methodName === 'CheckAuth') return false;
            if (methodName.startsWith('GetSettings') || methodName.startsWith('GetUserInfo')) return {};
            return [];
          };
        }
      })
    }
  };
}

if (!window['runtime']) {
  window['runtime'] = {
    // Events
    EventsOn: function() { return function() {}; },
    EventsOff: function() { return function() {}; },
    EventsOffAll: function() {},
    EventsOnMultiple: function() { return function() {}; },
    EventsOnce: function() { return function() {}; },
    EventsEmit: function() {},

    // Logging
    LogPrint: function() {},
    LogTrace: function() {},
    LogDebug: function(msg) { console.log('[Debug]', msg); },
    LogInfo: function(msg) { console.log('[Info]', msg); },
    LogWarning: function(msg) { console.warn('[Warning]', msg); },
    LogError: function(msg) { console.error('[Error]', msg); },
    LogFatal: function(msg) { console.error('[Fatal]', msg); },

    // Window controls
    WindowSetTitle: function() {},
    WindowMinimise: function() {},
    WindowUnminimise: function() {},
    WindowMaximise: function() {},
    WindowToggleMaximise: function() {},
    WindowUnmaximise: function() {},
    WindowIsMaximised: function() { return false; },
    WindowIsMinimised: function() { return false; },
    WindowIsNormal: function() { return true; },
    WindowHide: function() {},
    WindowShow: function() {},
    WindowReload: function() {},
    WindowReloadApp: function() {},
    WindowCenter: function() {},
    WindowFullscreen: function() {},
    WindowUnfullscreen: function() {},
    WindowIsFullscreen: function() { return false; },
    WindowSetSystemDefaultTheme: function() {},
    WindowSetLightTheme: function() {},
    WindowSetDarkTheme: function() {},
    WindowSetLightingMode: function() {},
    WindowSetAlwaysOnTop: function() {},
    WindowSetPosition: function() {},
    WindowGetPosition: function() { return Promise.resolve({x:0, y:0}); },
    WindowSetSize: function() {},
    WindowGetSize: function() { return Promise.resolve({w:1200, h:800}); },
    WindowSetMinSize: function() {},
    WindowSetMaxSize: function() {},
    WindowSetBackgroundColour: function() {},
    ScreenGetAll: function() { return Promise.resolve([]); },
    BrowserOpenURL: function(url) { window.open(url, '_blank'); },
    Environment: function() { return Promise.resolve({buildType:'production', platform:'web', arch:'amd64'}); },
    Quit: function() {},
    Hide: function() {},
    Show: function() {},

    // Clipboard
    ClipboardGetText: function() { return Promise.resolve(''); },
    ClipboardSetText: function() { return Promise.resolve(true); },

    // Drag and Drop
    OnFileDrop: function() { return function() {}; },
    OnFileDropOff: function() {},
    CanResolveFilePaths: function() { return false; },
    ResolveFilePaths: function() { return Promise.resolve([]); },

    // Notifications
    InitializeNotifications: function() {},
    CleanupNotifications: function() {},
    IsNotificationAvailable: function() { return Promise.resolve(false); },
    RequestNotificationAuthorization: function() { return Promise.resolve(false); },
    CheckNotificationAuthorization: function() { return Promise.resolve(false); },
    SendNotification: function() {},
    SendNotificationWithActions: function() {},
    RegisterNotificationCategory: function() {},
    RemoveNotificationCategory: function() {},
    RemoveAllPendingNotifications: function() {},
    RemovePendingNotification: function() {},
    RemoveAllDeliveredNotifications: function() {},
    RemoveDeliveredNotification: function() {},
    RemoveNotification: function() {}
  };
}
