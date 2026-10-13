/** Browser game launch — isolated iframe, separate origin, no marketplace cookie access */
export const IFRAME_POLICY = {
  sandbox: 'allow-scripts allow-pointer-lock allow-popups allow-forms',
  allow: 'fullscreen; autoplay',
  referrerPolicy: 'no-referrer',
  // Do NOT allow allow-same-origin unless on dedicated isolated origin
  origins: {
    www: 'www.example.com',
    play: 'play.example.com',  // separate origin for browser games
    cdn: 'cdn.example.com',
    uploads: 'uploads.example.com',
    api: 'api.example.com',
  }
};
