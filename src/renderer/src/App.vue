<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const videoFiles = ref<string[]>([])
const lutFile = ref<string | null>(null)
const outputDir = ref<string | null>(null)
const accelMode = ref('cpu')
const statusMessage = ref('请选择或拖拽 MP4 视频素材')
const isProcessing = ref(false)
const isFinished = ref(false)
const currentFile = ref('')
const progressText = ref('')
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
      } else if (data.status === 'completed') {
        stopTimer(); isProcessing.value = false; isFinished.value = true; percent.value = 100
        statusMessage.value = `处理完成！成功: ${data.successCount}/${data.totalCount}`
      } else if (data.status === 'stopped') {
        stopTimer(); isProcessing.value = false; statusMessage.value = '导出已中止，缓存已清理'; currentFile.value = ''; percent.value = 0
      } else if (data.status === 'error') {
        stopTimer(); isProcessing.value = false; errorMessage.value = `文件 ${data.filename} 失败: ${data.error.slice(0, 80)}`
      }
    })
  }
})

const removeVideo = (index: number) => {
  if (isProcessing.value) return
  videoFiles.value.splice(index, 1)
  if (videoFiles.value.length === 0) statusMessage.value = '请选择或拖拽 MP4 视频素材'
  else statusMessage.value = `已添加 ${videoFiles.value.length} 个视频`
}

const clearVideos = () => {
  if (isProcessing.value) return
  videoFiles.value = []
  statusMessage.value = '请选择或拖拽 MP4 视频素材'
  percent.value = 0
}

const removeLut = () => { if (isProcessing.value) return; lutFile.value = null }
const stopExport = () => { if (confirm('确定要中止当前的导出任务吗？')) (window as any).api.stopConversion() }
const startTimer = () => { durationSec.value = 0; timerInterval = setInterval(() => { durationSec.value++ }, 1000) }
const stopTimer = () => { if (timerInterval) { clearInterval(timerInterval); timerInterval = null } }
onUnmounted(() => stopTimer())

const selectVideos = async () => {
  if (isProcessing.value) return
  const paths = await (window as any).api.selectVideos()
  if (paths && paths.length > 0) {
    videoFiles.value = [...videoFiles.value, ...paths]
    statusMessage.value = `已添加 ${videoFiles.value.length} 个视频`; isFinished.value = false
  }
}
const selectLut = async () => { if (isProcessing.value) return; const path = await (window as any).api.selectCube(); if (path) lutFile.value = path }
const selectOutputDir = async () => { if (isProcessing.value) return; const path = await (window as any).api.selectOutputDir(); if (path) outputDir.value = path }
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
const formatTime = (s: number) => { if (s < 60) return `${s}s`; return `${Math.floor(s / 60)}m ${s % 60}s` }
</script>

<template>
  <div class="container">
    <div class="header">
      <h1>批量色彩还原工具</h1>
      <p>DJI Pocket / Action 专属 <span class="badge">智能规格自适应</span></p>
    </div>

    <div class="drop-zone" :class="{ 'has-files': videoFiles.length > 0, 'processing': isProcessing }" @click="selectVideos">
      <div v-if="videoFiles.length === 0" class="empty-hint">点击或拖拽此处选择 MP4 视频</div>
      <div v-else class="file-list-container">
        <div class="count-header">
          <p class="count-hint">已选取 {{ videoFiles.length }} 个视频</p>
          <span class="clear-btn" v-if="!isProcessing" @click.stop="clearVideos">一键清空</span>
        </div>
        <div class="file-grid">
          <div v-for="(f, i) in videoFiles" :key="i" class="file-item">
            <span class="file-name">{{ f.split('\\').pop() }}</span>
            <span class="remove-btn" :class="{ disabled: isProcessing }" @click.stop="removeVideo(i)">×</span>
          </div>
          <div class="add-more-item" v-if="!isProcessing"><span>+ 继续添加视频</span></div>
        </div>
      </div>
    </div>

    <div class="controls">
      <div class="control-row">
        <!-- 修正后的文字判断逻辑 -->
        <button class="fixed-btn" :disabled="isProcessing" @click.stop="selectLut" :class="{ active: lutFile }">
          {{ lutFile ? '已选 LUT' : '选择 LUT' }}
        </button>
        <div class="info-box" v-if="lutFile">
          <span class="path-text">{{ lutFile.split('\\').pop() }}</span>
          <span class="remove-btn mini" :class="{ disabled: isProcessing }" @click.stop="removeLut">×</span>
        </div>
        <div class="info-box empty" v-else>未选择 .cube 文件</div>
      </div>

      <div class="control-row">
        <!-- 修正后的文字判断逻辑 -->
        <button class="fixed-btn" :disabled="isProcessing" @click.stop="selectOutputDir" :class="{ active: outputDir }">
          {{ outputDir ? '已选目录' : '选择目录' }}
        </button>
        <div class="info-box" v-if="outputDir"><span class="path-text">{{ outputDir }}</span></div>
        <div class="info-box empty" v-else>未选择保存路径</div>
      </div>

      <div class="accel-selection">
        <span class="label">硬件加速：</span>
        <label><input type="radio" :disabled="isProcessing" v-model="accelMode" value="cpu"> CPU</label>
        <label><input type="radio" :disabled="isProcessing" v-model="accelMode" value="nvenc"> NVIDIA</label>
        <label><input type="radio" :disabled="isProcessing" v-model="accelMode" value="amf"> AMD</label>
      </div>
      <div class="action-btns">
        <button class="start-btn" :disabled="isProcessing" @click.stop="start">{{ isProcessing ? '正在处理...' : '开始批量导出' }}</button>
        <button v-if="isProcessing" class="stop-btn" @click.stop="stopExport">中止导出</button>
        <button v-if="isFinished" class="open-btn" @click.stop="openFolder">打开导出目录</button>
      </div>
    </div>

    <div class="status-bar">
      <p v-if="!errorMessage && !isProcessing && !isFinished" class="hint-text">{{ statusMessage }}</p>
      <p v-if="isFinished && !isProcessing" class="success-text">{{ statusMessage }}</p>
      <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
      <div v-if="isProcessing || percent > 0" class="progress-container">
        <div class="progress-info">
          <span>{{ progressText }}</span>
          <span class="timer-text" v-if="durationSec > 0">耗时: {{ formatTime(durationSec) }}</span>
          <span>{{ percent }}%</span>
        </div>
        <div class="progress-bar-bg"><div class="progress-bar-fill" :style="{ width: percent + '%' }"></div></div>
        <p class="current-name" v-if="currentFile">{{ currentFile }}</p>
      </div>
    </div>
  </div>
</template>

<style>
body { background: #1a1a1a; color: #fff; font-family: -apple-system, sans-serif; margin: 0; overflow: hidden; }
.container { display: flex; flex-direction: column; height: 100vh; padding: 20px 40px; box-sizing: border-box; align-items: center; }

.header { text-align: center; margin-bottom: 10px; width: 100%; }
.header h1 { margin: 0; font-size: 24px; color: #42b883; }
.header p { color: #888; font-size: 13px; margin: 5px 0; }
.badge { background: #222; color: #42b883; padding: 2px 8px; border-radius: 4px; font-size: 10px; margin-left: 5px; border: 1px solid #333; }

.drop-zone { width: 100%; max-width: 1000px; height: 380px; border: 2px dashed #444; border-radius: 12px; background: #222; margin-bottom: 15px; overflow: hidden; display: flex; flex-direction: column; cursor: pointer; }
.drop-zone:hover:not(.processing) { background: #262626; }
.drop-zone.has-files { border-color: #42b883; border-style: solid; background: #1b2420; }
.drop-zone.processing { cursor: not-allowed; }

.empty-hint { flex: 1; display: flex; align-items: center; justify-content: center; color: #666; font-size: 16px; }

.file-list-container { flex: 1; padding: 12px; display: flex; flex-direction: column; overflow: hidden; }
.count-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding: 0 5px; }
.count-hint { color: #42b883; font-weight: bold; font-size: 13px; margin: 0; }
.clear-btn { color: #888; font-size: 11px; background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 4px; cursor: pointer; }
.clear-btn:hover { color: #ff5252; background: rgba(255,82,82,0.1); }

.file-grid { flex: 1; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; padding-right: 5px; align-content: start; }
.file-grid::-webkit-scrollbar { width: 4px; }
.file-grid::-webkit-scrollbar-thumb { background: #444; border-radius: 2px; }

.file-item { height: 34px; display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); padding: 0 10px; border-radius: 6px; font-size: 11px; box-sizing: border-box; }
.file-name { color: #ccc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px; }

.remove-btn { color: #888; cursor: pointer; font-weight: bold; font-size: 15px; padding: 0 5px; transition: all 0.2s; }
.remove-btn:hover:not(.disabled) { color: #ff5252; }
.remove-btn.disabled { cursor: not-allowed !important; color: #444 !important; opacity: 0.5; }
.remove-btn.mini { font-size: 14px; margin-left: 10px; }

.add-more-item { height: 34px; display: flex; align-items: center; justify-content: center; border: 1px dashed #444; border-radius: 6px; color: #555; font-size: 11px; }
.add-more-item:hover { color: #42b883; border-color: #42b883; background: rgba(66,184,131,0.05); }

.controls { width: 100%; max-width: 1000px; display: flex; flex-direction: column; gap: 8px; align-items: center; }
.control-row { display: flex; align-items: center; gap: 15px; width: 100%; }
.fixed-btn { width: 110px; flex-shrink: 0; background: #333; color: #eee; border: none; padding: 10px 0; border-radius: 6px; cursor: pointer; font-size: 12px; }
.fixed-btn.active { background: #1b5e20; color: #a5d6a7; }
.info-box { flex: 1; background: rgba(0,0,0,0.2); padding: 8px 12px; border-radius: 6px; border: 1px solid #333; display: flex; align-items: center; justify-content: space-between; min-height: 34px; box-sizing: border-box; }
.info-box.empty { color: #555; font-style: italic; font-size: 11px; }
.path-text { font-size: 11px; color: #999; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; text-align: left; }

.accel-selection { font-size: 12px; color: #777; display: flex; gap: 20px; margin: 3px 0; width: 100%; justify-content: center; }
.accel-selection label { cursor: pointer; display: flex; align-items: center; gap: 5px; }

.action-btns { display: flex; gap: 12px; margin-top: 5px; width: 100%; justify-content: center; }
.start-btn { background: #42b883; color: #1a1a1a; font-weight: bold; padding: 10px 50px; font-size: 14px; border: none; border-radius: 8px; cursor: pointer; }
.start-btn:disabled { background: #2a5a44; color: #666; cursor: not-allowed; }
.stop-btn { background: #d32f2f; color: #fff; padding: 0 20px; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 13px; }
.open-btn { background: #2196f3; color: #fff; padding: 0 20px; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 13px; }

.status-bar { width: 100%; max-width: 1000px; margin-top: 10px; border-top: 1px solid #333; padding-top: 8px; min-height: 80px; }
.hint-text { color: #555; font-size: 12px; margin: 0; }
.success-text { color: #42b883; font-weight: bold; font-size: 13px; margin: 0; }
.error-text { color: #ff5252; font-size: 11px; margin: 0; }

.progress-container { width: 100%; }
.progress-info { display: flex; justify-content: space-between; font-size: 11px; color: #42b883; margin-bottom: 5px; }
.timer-text { color: #2196f3; font-weight: bold; }
.progress-bar-bg { width: 100%; height: 5px; background: #333; border-radius: 3px; overflow: hidden; }
.progress-bar-fill { height: 100%; background: #42b883; transition: width 0.3s; }
.current-name { font-size: 10px; color: #777; margin-top: 5px; text-align: center; }
</style>
