<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const videoFiles = ref<string[]>([])
const lutFile = ref<string | null>(null)
const outputDir = ref<string | null>(null)
const accelMode = ref('nvenc') // Default to NVIDIA as in design
const statusMessage = ref('Ready')
const isProcessing = ref(false)
const isFinished = ref(false)
const currentFile = ref('')
const progressText = ref('等待输入...')
const percent = ref(0)
const errorMessage = ref('')
const durationSec = ref(0)
let timerInterval: any = null

onMounted(() => {
  if ((window as any).api) {
    ;(window as any).api.onProgress((data: any) => {
      if (data.status === 'processing') {
        isProcessing.value = true; isFinished.value = false; errorMessage.value = ''
        currentFile.value = data.filename
        progressText.value = `正在处理 (${data.index + 1}/${data.total})`
        if (data.percent) percent.value = data.percent
        statusMessage.value = 'Processing'
      } else if (data.status === 'completed') {
        stopTimer(); isProcessing.value = false; isFinished.value = true; percent.value = 100
        statusMessage.value = 'Completed'
        progressText.value = `处理完成！成功: ${data.successCount}/${data.totalCount}`
      } else if (data.status === 'stopped') {
        stopTimer(); isProcessing.value = false; statusMessage.value = 'Ready'; currentFile.value = ''; percent.value = 0
        progressText.value = '导出已中止'
      } else if (data.status === 'error') {
        stopTimer(); isProcessing.value = false; errorMessage.value = `文件 ${data.filename} 失败: ${data.error.slice(0, 80)}`
        statusMessage.value = 'Error'
        progressText.value = '发生错误'
      }
    })
  }
})

const removeVideo = (index: number) => {
  if (isProcessing.value) return
  videoFiles.value.splice(index, 1)
}

const clearVideos = () => {
  if (isProcessing.value) return
  videoFiles.value = []
  percent.value = 0
  progressText.value = '队列已清空'
}

const stopExport = () => { if (confirm('确定要中止当前的导出任务吗？')) (window as any).api.stopConversion() }
const startTimer = () => { durationSec.value = 0; timerInterval = setInterval(() => { durationSec.value++ }, 1000) }
const stopTimer = () => { if (timerInterval) { clearInterval(timerInterval); timerInterval = null } }
onUnmounted(() => stopTimer())

const selectVideos = async () => {
  if (isProcessing.value) return
  const paths = await (window as any).api.selectVideos()
  if (paths && paths.length > 0) {
    videoFiles.value = [...videoFiles.value, ...paths]
    isFinished.value = false
    progressText.value = `已添加 ${paths.length} 个视频`
  }
}

const selectLut = async () => { 
  if (isProcessing.value) return
  const path = await (window as any).api.selectCube()
  if (path) {
    lutFile.value = path
    progressText.value = '已选择 LUT 文件'
  }
}

const selectOutputDir = async () => { 
  if (isProcessing.value) return
  const path = await (window as any).api.selectOutputDir()
  if (path) {
    outputDir.value = path
    progressText.value = '已设置输出目录'
  }
}

const openFolder = () => { if (outputDir.value) (window as any).api.openFolder(outputDir.value) }

const start = () => {
  if (videoFiles.value.length === 0) return alert('请先选择视频素材')
  if (!lutFile.value) return alert('请先选择 LUT 文件')
  if (!outputDir.value) return alert('请选择导出目录')
  isProcessing.value = true; isFinished.value = false; percent.value = 0; errorMessage.value = ''; startTimer()
  ;(window as any).api.startConversion({
    videoFiles: JSON.parse(JSON.stringify(videoFiles.value)),
    lutFile: lutFile.value, outputDir: outputDir.value, accelMode: accelMode.value
  })
}

const formatTime = (s: number) => { 
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

const getFileName = (path: string) => path.split(/[\\/]/).pop() || ''
</script>

<template>
  <div class="bg-bg-app text-text-main h-screen w-full overflow-hidden flex flex-col font-sans antialiased selection:bg-primary-accent/30 selection:text-white">
    <!-- Top App Bar -->
    <header class="h-14 border-b border-border-dim bg-bg-sidebar flex items-center justify-between px-4 shrink-0 z-20">
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2 text-primary-accent">
          <span class="material-symbols-outlined text-[20px]">video_settings</span>
          <h1 class="font-bold tracking-tight text-[15px] text-white">批量色彩还原工具 <span class="font-normal text-text-muted text-[13px] ml-1">Pro v2.1.0</span></h1>
        </div>
        <div class="h-4 w-px bg-border-dim mx-2"></div>
        <div class="flex items-center gap-2">
          <span class="font-mono text-[11px] text-text-muted uppercase tracking-wider bg-bg-surface px-2 py-0.5 rounded border border-border-dim">DJI Pocket / Action 专属</span>
          <span class="font-mono text-[11px] text-primary-accent bg-primary-accent/10 border border-primary-accent/20 px-2 py-0.5 rounded">智能规格自适应</span>
        </div>
      </div>
    </header>

    <!-- Main Workspace Layout -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Center Column: File Management -->
      <main class="flex-1 flex flex-col bg-bg-app overflow-hidden relative">
        <!-- Toolbar -->
        <div class="h-12 border-b border-border-dim flex items-center justify-between px-6 shrink-0 bg-bg-panel/50 backdrop-blur-sm">
          <div class="flex items-center gap-4">
            <h2 class="text-[14px] font-medium text-white flex items-center gap-2">
              <span class="material-symbols-outlined text-[18px] text-text-muted">queue</span>
              队列视频 ({{ videoFiles.length }})
            </h2>
          </div>
          <div class="flex items-center gap-2">
            <button 
              @click="selectVideos"
              :disabled="isProcessing"
              class="px-3 py-1.5 rounded-md flex items-center gap-1.5 text-[12px] font-medium text-text-main bg-bg-surface border border-border-light hover:bg-bg-surface-hover hover:border-text-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span class="material-symbols-outlined text-[16px]">add</span>
              添加文件
            </button>
            <button 
              @click="clearVideos"
              :disabled="isProcessing || videoFiles.length === 0"
              class="w-8 h-8 rounded-md flex items-center justify-center text-text-muted border border-border-dim hover:text-white hover:bg-bg-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span class="material-symbols-outlined text-[16px]">clear_all</span>
            </button>
          </div>
        </div>

        <!-- Media Grid Area -->
        <div class="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          <!-- Grid Container -->
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <!-- File Item -->
            <div 
              v-for="(file, index) in videoFiles" :key="index"
              class="group relative rounded-xl border border-border-dim bg-bg-panel p-3 hover:border-border-light hover:bg-bg-surface transition-all flex gap-4 cursor-default"
            >
              <div class="w-24 h-16 rounded-lg bg-[#1a201c] flex items-center justify-center shrink-0 border border-border-light relative overflow-hidden">
                <span class="material-symbols-outlined text-[24px] text-primary-accent/50 z-10">movie</span>
              </div>
              <div class="flex flex-col justify-center min-w-0 flex-1">
                <div class="flex justify-between items-start mb-1">
                  <h3 class="text-[13px] font-medium text-white truncate pr-2" :title="file">{{ getFileName(file) }}</h3>
                  <button 
                    @click.stop="removeVideo(index)"
                    :disabled="isProcessing"
                    class="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 transition-all disabled:hidden"
                  >
                    <span class="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
                <div class="flex flex-wrap gap-2 text-[11px] font-mono text-text-muted">
                  <span class="bg-bg-surface px-1.5 py-0.5 rounded border border-border-dim">MP4</span>
                  <span class="bg-bg-surface px-1.5 py-0.5 rounded border border-border-dim">10-bit</span>
                </div>
              </div>
            </div>

            <!-- Integrated Drop Zone -->
            <div 
              v-if="!isProcessing"
              @click="selectVideos"
              class="drop-zone-dashed h-full min-h-[88px] flex flex-col items-center justify-center text-text-muted hover:text-primary-accent hover:bg-primary-accent/5 transition-all cursor-pointer group"
            >
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-[20px] group-hover:-translate-y-1 transition-transform">cloud_upload</span>
                <span class="text-[13px] font-medium">拖拽或点击此处添加</span>
              </div>
            </div>
          </div>
          
          <!-- Empty State when processing and no files left to show? (Unlikely with loop but good to have) -->
          <div v-if="videoFiles.length === 0 && !isProcessing" class="flex-1 flex flex-col items-center justify-center text-text-dim opacity-50">
            <span class="material-symbols-outlined text-[48px] mb-2">video_library</span>
            <p class="text-[14px]">队列为空，请先添加素材</p>
          </div>
        </div>
      </main>

      <!-- Right Sidebar: Processing Console -->
      <aside class="w-80 border-l border-border-dim bg-bg-sidebar flex flex-col shrink-0 z-10 shadow-[-8px_0_24px_rgba(0,0,0,0.2)]">
        <div class="h-12 border-b border-border-dim flex items-center px-5 shrink-0">
          <h2 class="text-[14px] font-medium text-white uppercase tracking-wider flex items-center gap-2">
            <span class="material-symbols-outlined text-[16px] text-primary-accent">tune</span>
            控制台
          </h2>
        </div>
        <div class="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
          <!-- LUT Selection -->
          <div class="flex flex-col gap-2.5">
            <label class="text-[12px] font-semibold text-text-muted uppercase tracking-wider flex items-center justify-between">
              色彩预设
              <span class="text-[10px] bg-bg-surface px-1.5 py-0.5 rounded text-text-dim">.cube</span>
            </label>
            <div class="relative group">
              <button 
                @click="selectLut"
                :disabled="isProcessing"
                class="w-full bg-bg-panel border border-border-dim hover:border-primary-accent/50 rounded-lg p-3 flex flex-col items-start gap-1 transition-all focus:outline-none focus:ring-1 focus:ring-primary-accent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div class="flex items-center gap-2 text-white w-full">
                  <span class="material-symbols-outlined text-[18px] text-primary-accent">palette</span>
                  <span class="text-[13px] font-medium truncate">{{ lutFile ? getFileName(lutFile) : '未选择文件' }}</span>
                  <span class="material-symbols-outlined text-[16px] text-text-muted ml-auto">folder_open</span>
                </div>
                <span class="text-[11px] text-text-dim font-mono ml-6.5">{{ lutFile ? '点击更换 LUT' : '点击浏览 LUT 文件...' }}</span>
              </button>
            </div>
          </div>

          <!-- Output Directory -->
          <div class="flex flex-col gap-2.5">
            <label class="text-[12px] font-semibold text-text-muted uppercase tracking-wider flex items-center justify-between">
              输出位置
              <span class="material-symbols-outlined text-[14px] text-text-dim cursor-pointer hover:text-white">info</span>
            </label>
            <div class="relative group">
              <button 
                @click="selectOutputDir"
                :disabled="isProcessing"
                class="w-full bg-bg-panel border border-border-dim hover:border-border-light rounded-lg p-3 flex flex-col items-start gap-1 transition-all focus:outline-none focus:ring-1 focus:ring-primary-accent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div class="flex items-center gap-2 text-white w-full">
                  <span class="material-symbols-outlined text-[18px] text-text-muted">drive_folder_upload</span>
                  <span class="text-[13px] font-medium truncate">{{ outputDir || '未选择保存路径' }}</span>
                </div>
              </button>
            </div>
          </div>

          <hr class="border-border-dim"/>

          <!-- Hardware Settings -->
          <div class="flex flex-col gap-3">
            <label class="text-[12px] font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[14px]">memory</span>
              硬件加速引擎
            </label>
            <div class="grid grid-cols-3 gap-2">
              <label class="cursor-pointer">
                <input class="peer sr-only" name="hw_engine" type="radio" value="cpu" v-model="accelMode" :disabled="isProcessing" />
                <div class="flex items-center justify-center py-2 rounded-md border border-border-dim bg-bg-surface text-[12px] font-medium text-text-muted peer-checked:border-primary-accent peer-checked:text-primary-accent peer-checked:bg-primary-accent/10 hover:border-border-light transition-all peer-disabled:opacity-50">
                  CPU
                </div>
              </label>
              <label class="cursor-pointer">
                <input class="peer sr-only" name="hw_engine" type="radio" value="nvenc" v-model="accelMode" :disabled="isProcessing" />
                <div class="flex items-center justify-center py-2 rounded-md border border-border-dim bg-bg-surface text-[12px] font-medium text-text-muted peer-checked:border-primary-accent peer-checked:text-primary-accent peer-checked:bg-primary-accent/10 hover:border-border-light transition-all peer-disabled:opacity-50">
                  NVIDIA
                </div>
              </label>
              <label class="cursor-pointer">
                <input class="peer sr-only" name="hw_engine" type="radio" value="amf" v-model="accelMode" :disabled="isProcessing" />
                <div class="flex items-center justify-center py-2 rounded-md border border-border-dim bg-bg-surface text-[12px] font-medium text-text-muted peer-checked:border-primary-accent peer-checked:text-primary-accent peer-checked:bg-primary-accent/10 hover:border-border-light transition-all peer-disabled:opacity-50">
                  AMD
                </div>
              </label>
            </div>
          </div>
          
          <!-- Open Folder Link -->
          <button 
            v-if="isFinished && outputDir"
            @click="openFolder"
            class="text-[12px] text-primary-accent hover:underline flex items-center gap-1.5 mt-auto"
          >
            <span class="material-symbols-outlined text-[16px]">folder_open</span>
            打开导出目录
          </button>
        </div>

        <!-- Action Area -->
        <div class="p-5 border-t border-border-dim bg-bg-panel/50">
          <button 
            v-if="!isProcessing"
            @click="start"
            class="w-full bg-primary-accent hover:bg-primary-accent-hover text-[#0a0c0b] font-bold text-[15px] py-3.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-glow-md hover:shadow-lg active:scale-[0.98]"
          >
            <span class="material-symbols-outlined text-[20px]">play_circle</span>
            开始批量导出
          </button>
          <button 
            v-else
            @click="stopExport"
            class="w-full bg-red-500 hover:bg-red-600 text-white font-bold text-[15px] py-3.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]"
          >
            <span class="material-symbols-outlined text-[20px]">stop_circle</span>
            中止导出任务
          </button>
        </div>
      </aside>
    </div>

    <!-- Persistent Bottom Status Bar -->
    <footer class="h-10 border-t border-border-dim bg-[#080908] flex items-center justify-between px-4 shrink-0 z-30 font-mono text-[11px]">
      <div class="flex items-center gap-4 flex-1 overflow-hidden">
        <!-- Status Indicator -->
        <div class="flex items-center gap-2 shrink-0">
          <span class="relative flex h-2 w-2">
            <span :class="['absolute inline-flex h-full w-full rounded-full opacity-75', isProcessing ? 'animate-ping bg-primary-accent' : 'bg-text-dim']"></span>
            <span :class="['relative inline-flex rounded-full h-2 w-2', isProcessing ? 'bg-primary-accent' : 'bg-text-dim']"></span>
          </span>
          <span class="text-text-muted uppercase">{{ statusMessage }}</span>
        </div>
        <div class="w-px h-3 bg-border-dim shrink-0"></div>
        <!-- Current Task Log -->
        <div class="text-text-dim flex-1 truncate" :class="{ 'text-red-400': errorMessage }">
          &gt; {{ errorMessage || progressText || '等待输入...' }}
        </div>
      </div>
      
      <!-- Progress Section -->
      <div v-if="isProcessing || percent > 0" class="flex items-center gap-4 w-1/3 justify-end">
        <div class="text-text-muted shrink-0" v-if="durationSec > 0">耗时: {{ formatTime(durationSec) }}</div>
        <div class="w-32 h-1.5 bg-bg-surface rounded-full overflow-hidden border border-border-dim shrink-0">
          <div class="h-full bg-primary-accent transition-all duration-300" :style="{ width: percent + '%' }"></div>
        </div>
        <div class="text-primary-accent font-semibold w-8 text-right shrink-0">{{ percent }}%</div>
      </div>
    </footer>
  </div>
</template>

<style>
/* Reset some default Electron/Vite styles if necessary */
#app {
  height: 100vh;
  width: 100vw;
}

/* Material symbols override for alignment */
.material-symbols-outlined {
  vertical-align: middle;
  line-height: 1;
}
</style>
