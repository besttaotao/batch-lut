import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, basename, extname } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { spawn, spawnSync, ChildProcess } from 'child_process'
import fs from 'fs'
import os from 'os'

const getBinPath = (name: string) => {
  if (is.dev) return join(app.getAppPath(), 'resources', 'bin', name)
  return join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'bin', name)
}

let mainWindow: BrowserWindow | null = null
let currentFFmpegProcess: ChildProcess | null = null
let isStopping = false

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 950,
    height: 700,
    minWidth: 900,
    minHeight: 650,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: false }
  })
  mainWindow.on('ready-to-show', () => mainWindow?.show())
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  else mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
}

const getVideoMeta = (binPath: string, file: string) => {
  try {
    const ffprobePath = binPath.replace('ffmpeg.exe', 'ffprobe.exe')
    const result = spawnSync(ffprobePath, [
      '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'format=bit_rate:stream=duration,r_frame_rate,codec_name', '-of', 'json', file
    ])
    const data = JSON.parse(result.stdout.toString())
    return {
      duration: parseFloat(data.streams[0].duration) || 0,
      bitrate: parseInt(data.format.bit_rate) || 80000000,
      fps: data.streams[0].r_frame_rate,
      codec: data.streams[0].codec_name
    }
  } catch (e) { return { duration: 0, bitrate: 80000000, fps: '60/1', codec: 'hevc' } }
}

ipcMain.handle('select-videos', async () => {
  if (!mainWindow) return []
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: '视频文件', extensions: ['mp4'] }]
  })
  return canceled ? [] : filePaths
})

ipcMain.handle('select-cube', async () => {
  if (!mainWindow) return null
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'LUT 文件', extensions: ['cube'] }]
  })
  return canceled ? null : filePaths[0]
})

ipcMain.handle('select-output-dir', async () => {
  if (!mainWindow) return null
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  })
  return canceled ? null : filePaths[0]
})

ipcMain.handle('open-folder', async (_event, path) => { if (path) shell.openPath(path) })

// 中止导出处理
ipcMain.on('stop-conversion', () => {
  if (currentFFmpegProcess) {
    isStopping = true
    currentFFmpegProcess.kill('SIGKILL')
  }
})

ipcMain.on('start-conversion', async (_event, { videoFiles, lutFile, outputDir, accelMode }) => {
  if (!mainWindow) return
  const ffmpegPath = getBinPath('ffmpeg.exe')
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

  const tempLutPath = join(os.tmpdir(), `temp_color_tool_${Date.now()}.cube`)
  try { fs.copyFileSync(lutFile, tempLutPath) } catch (e) { return }
  const escapedTempLut = tempLutPath.replace(/\\/g, '/').replace(/:/g, '\\:')
  
  let totalSuccess = 0
  isStopping = false

  for (let i = 0; i < videoFiles.length; i++) {
    if (isStopping) break // 如果点击了停止，直接跳出大循环

    const videoFile = videoFiles[i]
    const videoName = basename(videoFile)
    const ext = extname(videoName)
    const pureName = videoName.replace(ext, '')

    let modeTag = '_还原'
    if (accelMode === 'cpu') modeTag += '_CPU'
    else if (accelMode === 'nvenc') modeTag += '_NVIDIA'
    else if (accelMode === 'amf') modeTag += '_AMD'

    const outputFile = join(outputDir, `${pureName}${modeTag}${ext}`)
    const meta = getVideoMeta(ffmpegPath, videoFile)
    
    mainWindow.webContents.send('conversion-progress', { 
      index: i, total: videoFiles.length, status: 'processing', filename: videoName, percent: 0 
    })

    let v_codec = ''
    const isHEVC = meta.codec === 'hevc' || meta.codec === 'h265'
    if (accelMode === 'nvenc') v_codec = isHEVC ? 'hevc_nvenc' : 'h264_nvenc'
    else if (accelMode === 'amf') v_codec = isHEVC ? 'hevc_amf' : 'h264_amf'
    else v_codec = isHEVC ? 'libx265' : 'libx264'

    const args = ['-y', '-i', videoFile, '-vf', `lut3d=file='${escapedTempLut}',format=yuv420p`, '-c:v', v_codec, '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-map_metadata', '0', outputFile]
    const b_val = `${Math.round(meta.bitrate / 1000)}k`
    if (v_codec.includes('nvenc')) args.splice(7, 0, '-rc', 'vbr', '-cq', '15', '-b:v', b_val, '-maxrate', `${Math.round(meta.bitrate * 1.5 / 1000)}k`)
    else if (v_codec.includes('amf')) args.splice(7, 0, '-rc', 'cbr', '-quality', 'quality', '-b:v', b_val)
    else args.splice(7, 0, '-crf', '15', '-preset', 'medium')

    try {
      await new Promise((resolve, reject) => {
        currentFFmpegProcess = spawn(ffmpegPath, args)
        let lastErr = ''
        
        currentFFmpegProcess.stderr?.on('data', (d) => {
          const s = d.toString(); lastErr = s
          const m = s.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/)
          if (m && meta.duration > 0) {
            const sec = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3])
            const p = Math.round((sec / meta.duration) * 100)
            mainWindow?.webContents.send('conversion-progress', { index: i, total: videoFiles.length, status: 'processing', filename: videoName, percent: Math.min(p, 99) })
          }
        })
        
        currentFFmpegProcess.on('close', (code) => {
          currentFFmpegProcess = null
          if (code === 0) resolve(null)
          else if (isStopping) reject(new Error('USER_STOP'))
          else reject(new Error(lastErr))
        })
      })
      totalSuccess++
    } catch (err: any) {
      if (err.message === 'USER_STOP') {
        // 如果是手动停止，清理不完整的文件
        if (fs.existsSync(outputFile)) {
          try { fs.unlinkSync(outputFile) } catch (e) {}
        }
        break // 跳出循环
      }
      mainWindow.webContents.send('conversion-progress', { status: 'error', filename: videoName, error: err.message })
    }
  }

  try { fs.unlinkSync(tempLutPath) } catch (e) {}
  mainWindow.webContents.send('conversion-progress', { 
    status: isStopping ? 'stopped' : 'completed', 
    successCount: totalSuccess, 
    totalCount: videoFiles.length 
  })
})

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
  createWindow()
})
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit())
