import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  selectVideos: () => ipcRenderer.invoke('select-videos'),
  selectCube: () => ipcRenderer.invoke('select-cube'),
  selectOutputDir: () => ipcRenderer.invoke('select-output-dir'),
  openFolder: (path) => ipcRenderer.invoke('open-folder', path),
  getAccelerationProfile: () => ipcRenderer.invoke('get-acceleration-profile'),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  startConversion: (options) => ipcRenderer.send('start-conversion', options),
  stopConversion: () => ipcRenderer.send('stop-conversion'),
  onProgress: (callback) =>
    ipcRenderer.on('conversion-progress', (_event, value) => callback(value))
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
