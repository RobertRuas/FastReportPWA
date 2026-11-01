<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const status = ref<'loading' | 'ready' | 'downloading' | 'done' | 'expired'>('loading')
const projectName = ref('')
const downloadUrl = ref('')

onMounted(() => {
  const url = route.query.url as string
  const name = route.query.name as string
  projectName.value = name || 'Projeto'

  if (!url) {
    status.value = 'expired'
    return
  }

  downloadUrl.value = url

  try {
    const parsed = new URL(url)
    const expires = parsed.searchParams.get('token')
    if (expires) {
      const payload = JSON.parse(atob(expires.split('.')[1]))
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        status.value = 'expired'
        return
      }
    }
  } catch { /* ignore parse errors */ }

  status.value = 'ready'
})

async function doDownload() {
  status.value = 'downloading'
  try {
    const res = await fetch(downloadUrl.value)
    if (!res.ok) {
      status.value = 'expired'
      return
    }
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${projectName.value}.zip`
    a.click()
    URL.revokeObjectURL(a.href)
    status.value = 'done'
  } catch {
    status.value = 'expired'
  }
}
</script>

<template>
  <div class="download-page">
    <div class="download-card">
      <div class="download-icon">
        <i v-if="status === 'loading'" class="pi pi-spin pi-spinner" />
        <i v-else-if="status === 'expired'" class="pi pi-times-circle" />
        <i v-else-if="status === 'done'" class="pi pi-check-circle" />
        <i v-else-if="status === 'downloading'" class="pi pi-spin pi-spinner" />
        <i v-else class="pi pi-file-arrow-down" />
      </div>

      <h1 class="download-title">{{ projectName }}</h1>

      <template v-if="status === 'ready'">
        <p class="download-text">O ficheiro ZIP está pronto para download.</p>
        <button class="download-btn" @click="doDownload">
          <i class="pi pi-download" />
          Baixar ZIP
        </button>
        <p class="download-hint">Este link expira em 1 hora.</p>
      </template>

      <template v-else-if="status === 'downloading'">
        <p class="download-text">A preparar o download...</p>
      </template>

      <template v-else-if="status === 'done'">
        <p class="download-text download-success">Download concluído!</p>
        <p class="download-hint">O ficheiro ZIP pode ser importado diretamente no FastReport.</p>
      </template>

      <template v-else-if="status === 'expired'">
        <p class="download-text download-error">Este link expirou ou é inválido.</p>
        <p class="download-hint">Peça um novo link de download ao remetente.</p>
      </template>

      <div class="download-brand">
        <span>FastReport PWA</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.download-page {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-secondary);
  padding: var(--spacing-lg);
}

.download-card {
  background: var(--color-bg-primary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl) var(--spacing-xl) var(--spacing-lg);
  max-width: 380px;
  width: 100%;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.download-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--color-bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto var(--spacing-lg);
}

.download-icon i {
  font-size: 28px;
  color: var(--color-accent);
}

.download-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-sm);
}

.download-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0 0 var(--spacing-lg);
}

.download-success {
  color: var(--color-success);
}

.download-error {
  color: var(--color-error);
}

.download-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-xl);
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  font-weight: 500;
  cursor: pointer;
  min-height: var(--touch-target);
  font-family: var(--font-family);
}

.download-btn:active {
  opacity: 0.85;
}

.download-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin: var(--spacing-md) 0 0;
  opacity: 0.7;
}

.download-brand {
  margin-top: var(--spacing-xl);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  opacity: 0.5;
}
</style>
