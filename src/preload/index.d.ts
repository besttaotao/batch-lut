import { ElectronAPI } from '@electron-toolkit/preload'

type AccelerationProfile = {
  mode: string
  label: string
  description: string
  h264Encoder: string
  hevcEncoder: string
  isHardware: boolean
}

type ConversionProgress =
  | {
      status: 'processing'
      index: number
      total: number
      filename: string
      percent: number
    }
  | {
      status: 'completed'
      successCount: number
      totalCount: number
    }
  | {
      status: 'stopped'
    }
  | {
      status: 'fallback'
      filename: string
    }
  | {
      status: 'error'
      filename: string
      error: string
    }

type ConversionOptions = {
  videoFiles: string[]
  lutFile: string
  outputDir: string
}

type AppAPI = {
  selectVideos: () => Promise<string[]>
  selectCube: () => Promise<string | null>
  selectOutputDir: () => Promise<string | null>
  openFolder: (path: string) => Promise<void>
  getAccelerationProfile: () => Promise<AccelerationProfile>
  getPathForFile: (file: File) => string
  startConversion: (options: ConversionOptions) => void
  stopConversion: () => void
  onProgress: (callback: (value: ConversionProgress) => void) => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppAPI
  }
}
