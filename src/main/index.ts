import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, basename, extname } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { spawn, spawnSync, ChildProcess } from 'child_process'
import fs from 'fs'
import os from 'os'

app.disableHardwareAcceleration()

type VideoMeta = {
  duration: number
  bitrate: number
  fps: string
  codec: string
}

const getBinPath = (name: string): string => {
  if (is.dev) return join(app.getAppPath(), 'resources', 'bin', name)
  return join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'bin', name)
}

let mainWindow: BrowserWindow | null = null
let currentFFmpegProcess: ChildProcess | null = null
let isStopping = false

type AccelerationMode = 'nvenc' | 'amf' | 'qsv' | 'cpu'
type VideoEncoder =
  | 'h264_nvenc'
  | 'hevc_nvenc'
  | 'h264_amf'
  | 'hevc_amf'
  | 'h264_qsv'
  | 'hevc_qsv'
  | 'libx264'
  | 'libx265'
type AccelerationProfile = {
  mode: AccelerationMode
  label: string
  description: string
  h264Encoder: VideoEncoder
  hevcEncoder: VideoEncoder
  isHardware: boolean
}
type ConversionPayload = {
  videoFiles: string[]
  lutFile: string
  outputDir: string
}

let accelerationProfile: AccelerationProfile | null = null

const cpuProfile: AccelerationProfile = {
  mode: 'cpu',
  label: 'CPU 兼容模式',
  description: '未检测到可用硬件编码，已自动使用兼容模式',
  h264Encoder: 'libx264',
  hevcEncoder: 'libx265',
  isHardware: false
}

const encoderProfiles: Array<{
  mode: Exclude<AccelerationMode, 'cpu'>
  label: string
  h264Encoder: VideoEncoder
  hevcEncoder: VideoEncoder
}> = [
  { mode: 'nvenc', label: 'NVIDIA 硬件加速', h264Encoder: 'h264_nvenc', hevcEncoder: 'hevc_nvenc' },
  { mode: 'amf', label: 'AMD 硬件加速', h264Encoder: 'h264_amf', hevcEncoder: 'hevc_amf' },
  { mode: 'qsv', label: 'Intel 核显加速', h264Encoder: 'h264_qsv', hevcEncoder: 'hevc_qsv' }
]

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
  if (is.dev && process.env['ELECTRON_RENDERER_URL'])
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  else mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
}

const getVideoMeta = (binPath: string, file: string): VideoMeta => {
  try {
    const ffprobePath = binPath.replace('ffmpeg.exe', 'ffprobe.exe')
    const result = spawnSync(ffprobePath, [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'format=bit_rate:stream=duration,r_frame_rate,codec_name',
      '-of',
      'json',
      file
    ])
    const data = JSON.parse(result.stdout.toString())
    return {
      duration: parseFloat(data.streams[0].duration) || 0,
      bitrate: parseInt(data.format.bit_rate) || 80000000,
      fps: data.streams[0].r_frame_rate,
      codec: data.streams[0].codec_name
    }
  } catch {
    return { duration: 0, bitrate: 80000000, fps: '60/1', codec: 'hevc' }
  }
}

const canUseEncoder = (ffmpegPath: string, encoder: VideoEncoder): boolean => {
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    'color=size=64x64:rate=1:duration=0.1',
    '-frames:v',
    '1',
    '-vf',
    encoder.includes('_qsv') ? 'format=nv12' : 'format=yuv420p',
    '-c:v',
    encoder,
    '-f',
    'null',
    '-'
  ]
  const result = spawnSync(ffmpegPath, args, { timeout: 10000 })
  return result.status === 0
}

const getAccelerationProfile = (): AccelerationProfile => {
  if (accelerationProfile) return accelerationProfile

  const ffmpegPath = getBinPath('ffmpeg.exe')
  for (const profile of encoderProfiles) {
    const canEncodeH264 = canUseEncoder(ffmpegPath, profile.h264Encoder)
    const canEncodeHEVC = canUseEncoder(ffmpegPath, profile.hevcEncoder)
    if (canEncodeH264 || canEncodeHEVC) {
      const formatDescription =
        canEncodeH264 && canEncodeHEVC
          ? 'H.264 与 H.265 均使用硬件编码'
          : `${canEncodeH264 ? 'H.264' : 'H.265'} 使用硬件编码，${canEncodeH264 ? 'H.265' : 'H.264'} 自动使用 CPU 兼容模式`
      accelerationProfile = {
        mode: profile.mode,
        label: canEncodeH264 && canEncodeHEVC ? profile.label : `${profile.label}（部分格式）`,
        description: `已为当前电脑找到最优加速路径：${formatDescription}`,
        h264Encoder: canEncodeH264 ? profile.h264Encoder : 'libx264',
        hevcEncoder: canEncodeHEVC ? profile.hevcEncoder : 'libx265',
        isHardware: true
      }
      return accelerationProfile
    }
  }

  accelerationProfile = cpuProfile
  return accelerationProfile
}

const getEncoderMode = (encoder: VideoEncoder): AccelerationMode => {
  if (encoder.includes('_nvenc')) return 'nvenc'
  if (encoder.includes('_amf')) return 'amf'
  if (encoder.includes('_qsv')) return 'qsv'
  return 'cpu'
}

const getModeTag = (mode: AccelerationMode): string => {
  if (mode === 'nvenc') return '_NVIDIA'
  if (mode === 'amf') return '_AMD'
  if (mode === 'qsv') return '_INTEL'
  return '_CPU'
}

const getAvailableOutputFile = (
  outputDir: string,
  pureName: string,
  mode: AccelerationMode,
  ext: string
): string => {
  const baseName = `${pureName}_还原${getModeTag(mode)}`
  let outputFile = join(outputDir, `${baseName}${ext}`)
  let index = 1

  while (fs.existsSync(outputFile)) {
    outputFile = join(outputDir, `${baseName}_${index}${ext}`)
    index++
  }

  return outputFile
}

const getCpuEncoder = (isHEVC: boolean): VideoEncoder => (isHEVC ? 'libx265' : 'libx264')

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error))

const removeFileIfExists = (file: string): void => {
  if (fs.existsSync(file)) fs.unlinkSync(file)
}

const parseProgressPercent = (stderr: string, duration: number): number | null => {
  const m = stderr.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/)
  if (!m || duration <= 0) return null

  const sec = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3])
  return Math.min(Math.round((sec / duration) * 100), 99)
}

const buildFfmpegArgs = (
  videoFile: string,
  outputFile: string,
  escapedTempLut: string,
  encoder: VideoEncoder,
  bitrate: number
): string[] => {
  const pixelFormat = encoder.includes('_qsv') ? 'nv12' : 'yuv420p'
  const args = [
    '-y',
    '-i',
    videoFile,
    '-vf',
    `lut3d=file='${escapedTempLut}',format=${pixelFormat}`,
    '-c:v',
    encoder
  ]
  const bitrateValue = `${Math.round(bitrate / 1000)}k`

  if (encoder.includes('_nvenc')) {
    args.push(
      '-rc',
      'vbr',
      '-cq',
      '15',
      '-b:v',
      bitrateValue,
      '-maxrate',
      `${Math.round((bitrate * 1.5) / 1000)}k`
    )
  } else if (encoder.includes('_amf')) {
    args.push('-rc', 'cbr', '-quality', 'quality', '-b:v', bitrateValue)
  } else if (encoder.includes('_qsv')) {
    args.push('-b:v', bitrateValue)
  } else {
    args.push('-crf', '15', '-preset', 'medium')
  }

  args.push('-pix_fmt', pixelFormat, '-c:a', 'copy', '-map_metadata', '0', outputFile)
  return args
}

const runFfmpeg = (
  ffmpegPath: string,
  args: string[],
  onProgress: (stderr: string) => void
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    currentFFmpegProcess = spawn(ffmpegPath, args)
    let lastErr = ''

    currentFFmpegProcess.stderr?.on('data', (d) => {
      const s = d.toString()
      lastErr = s
      onProgress(s)
    })

    currentFFmpegProcess.on('close', (code) => {
      currentFFmpegProcess = null
      if (code === 0) resolve()
      else if (isStopping) reject(new Error('USER_STOP'))
      else reject(new Error(lastErr || `ffmpeg exited with code ${code}`))
    })
  })
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

ipcMain.handle('open-folder', async (_event, path) => {
  if (path) shell.openPath(path)
})
ipcMain.handle('get-acceleration-profile', async () => getAccelerationProfile())

// 中止导出处理
ipcMain.on('stop-conversion', () => {
  if (currentFFmpegProcess) {
    isStopping = true
    currentFFmpegProcess.kill('SIGKILL')
  }
})

ipcMain.on(
  'start-conversion',
  async (_event, { videoFiles, lutFile, outputDir }: ConversionPayload) => {
    if (!mainWindow) return
    const ffmpegPath = getBinPath('ffmpeg.exe')
    const profile = getAccelerationProfile()
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

    const tempLutPath = join(os.tmpdir(), `temp_color_tool_${Date.now()}.cube`)
    try {
      fs.copyFileSync(lutFile, tempLutPath)
    } catch {
      return
    }
    const escapedTempLut = tempLutPath.replace(/\\/g, '/').replace(/:/g, '\\:')

    let totalSuccess = 0
    isStopping = false

    for (let i = 0; i < videoFiles.length; i++) {
      if (isStopping) break // 如果点击了停止，直接跳出大循环

      const videoFile = videoFiles[i]
      const videoName = basename(videoFile)
      const ext = extname(videoName)
      const pureName = videoName.replace(ext, '')
      const meta = getVideoMeta(ffmpegPath, videoFile)
      const isHEVC = meta.codec === 'hevc' || meta.codec === 'h265'
      const primaryEncoder = isHEVC ? profile.hevcEncoder : profile.h264Encoder
      const primaryMode = getEncoderMode(primaryEncoder)
      const primaryOutputFile = getAvailableOutputFile(outputDir, pureName, primaryMode, ext)

      mainWindow.webContents.send('conversion-progress', {
        index: i,
        total: videoFiles.length,
        status: 'processing',
        filename: videoName,
        percent: 0
      })

      try {
        const updateProgress = (stderr: string): void => {
          const percent = parseProgressPercent(stderr, meta.duration)
          if (percent !== null) {
            mainWindow?.webContents.send('conversion-progress', {
              index: i,
              total: videoFiles.length,
              status: 'processing',
              filename: videoName,
              percent
            })
          }
        }
        await runFfmpeg(
          ffmpegPath,
          buildFfmpegArgs(
            videoFile,
            primaryOutputFile,
            escapedTempLut,
            primaryEncoder,
            meta.bitrate
          ),
          updateProgress
        )
        totalSuccess++
      } catch (err) {
        const error = toError(err)
        if (error.message === 'USER_STOP') {
          // 如果是手动停止，清理不完整的文件
          removeFileIfExists(primaryOutputFile)
          break // 跳出循环
        }

        if (primaryMode !== 'cpu') {
          removeFileIfExists(primaryOutputFile)
          mainWindow.webContents.send('conversion-progress', {
            status: 'fallback',
            filename: videoName
          })
          const cpuOutputFile = getAvailableOutputFile(outputDir, pureName, 'cpu', ext)
          const cpuEncoder = getCpuEncoder(isHEVC)
          try {
            await runFfmpeg(
              ffmpegPath,
              buildFfmpegArgs(videoFile, cpuOutputFile, escapedTempLut, cpuEncoder, meta.bitrate),
              (stderr) => {
                const percent = parseProgressPercent(stderr, meta.duration)
                if (percent !== null) {
                  mainWindow?.webContents.send('conversion-progress', {
                    index: i,
                    total: videoFiles.length,
                    status: 'processing',
                    filename: videoName,
                    percent
                  })
                }
              }
            )
            totalSuccess++
          } catch (fallbackErr) {
            const fallbackError = toError(fallbackErr)
            if (fallbackError.message === 'USER_STOP') {
              removeFileIfExists(cpuOutputFile)
              break
            }
            mainWindow.webContents.send('conversion-progress', {
              status: 'error',
              filename: videoName,
              error: fallbackError.message
            })
          }
        } else {
          mainWindow.webContents.send('conversion-progress', {
            status: 'error',
            filename: videoName,
            error: error.message
          })
        }
      }
    }

    removeFileIfExists(tempLutPath)
    mainWindow.webContents.send('conversion-progress', {
      status: isStopping ? 'stopped' : 'completed',
      successCount: totalSuccess,
      totalCount: videoFiles.length
    })
  }
)

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
  createWindow()
})
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit())
