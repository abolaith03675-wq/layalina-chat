/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-afac4cd2'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "pwa-maskable-512x512.png",
    "revision": "9c29bc77ce11f439ada31b0e6d6f9d13"
  }, {
    "url": "pwa-512x512.png",
    "revision": "6f09c61069c3b06e92668de270568dc2"
  }, {
    "url": "pwa-192x192.png",
    "revision": "5825f55fa915ed30bb7f9fbb367e7f80"
  }, {
    "url": "index.html",
    "revision": "eb41f3be97867cc6526d6f3e1ed5a0b8"
  }, {
    "url": "icon.svg",
    "revision": "2779face1195b8e21d3e57367810ef5f"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "57bae1d7d88d8fe4edad03cbe63d8706"
  }, {
    "url": "assets/workbox-window.prod.es5-Bd17z0YL.js",
    "revision": null
  }, {
    "url": "assets/index-BsMkXHwj.js",
    "revision": null
  }, {
    "url": "assets/index-B0Mv7-SV.css",
    "revision": null
  }, {
    "url": "assets/aistudio/________7b81d3a3.png",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "57bae1d7d88d8fe4edad03cbe63d8706"
  }, {
    "url": "icon.svg",
    "revision": "2779face1195b8e21d3e57367810ef5f"
  }, {
    "url": "pwa-192x192.png",
    "revision": "5825f55fa915ed30bb7f9fbb367e7f80"
  }, {
    "url": "pwa-512x512.png",
    "revision": "6f09c61069c3b06e92668de270568dc2"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "9c29bc77ce11f439ada31b0e6d6f9d13"
  }, {
    "url": "manifest.webmanifest",
    "revision": "967fa796e60e80843e517d2038144b1c"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
