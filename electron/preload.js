// Kept minimal on purpose: the React app talks to the backend over plain HTTP,
// so it doesn't need privileged Node APIs in the renderer. Add bridges via
// contextBridge.exposeInMainWorld() here later if you ever do.
