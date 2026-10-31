<script setup lang="ts">
import { usePageTitle } from '@/composables/usePageTitle'
import { getAllMaps, getClassifiableSlots, hasGroups, getGroups } from '@/services/mapCatalog'
import type { OrganizationMap } from '@/models/types'

const { setTitle } = usePageTitle()
setTitle('Mapas')

const maps = getAllMaps()

function slotCount(map: OrganizationMap): number {
  return getClassifiableSlots(map).filter(s => !s.isTrash).length
}

function groupCount(map: OrganizationMap): number {
  return hasGroups(map) ? getGroups(map).length : 0
}

function slotNames(map: OrganizationMap): string {
  const slots = getClassifiableSlots(map).filter(s => !s.isTrash && s.id !== 'general')
  if (slots.length <= 6) return slots.map(s => s.folder).join(', ')
  return slots.slice(0, 5).map(s => s.folder).join(', ') + ` +${slots.length - 5}`
}

function mapDescription(map: OrganizationMap): string {
  if (map.id === 'inspection-t24') {
    return 'Mapa para inspeções com 24 pontos de observação (T1 a T24). Ideal para inspeções periódicas de estruturas com múltiplos pontos de registo fotográfico.'
  }
  if (map.id === 'tendons-retrofit') {
    return 'Mapa para retrofit de tendões com grupos C12 e C25. Cada grupo tem 7 fotos esperadas por slot. Usado em obras de reforço estrutural.'
  }
  return `Mapa com ${slotCount(map)} slots de classificação.`
}
</script>

<template>
  <div class="maps-page">

    <div v-for="map in maps" :key="map.id" class="map-card">
      <div class="map-card-header">
        <span class="map-card-icon">
          <i class="pi pi-th-large"></i>
        </span>
        <div class="map-card-title-area">
          <span class="map-card-name">{{ map.name.pt }}</span>
          <span class="map-card-meta">
            {{ slotCount(map) }} slots
            <template v-if="groupCount(map) > 0"> · {{ groupCount(map) }} grupos</template>
          </span>
        </div>
      </div>

      <p class="map-card-desc">{{ mapDescription(map) }}</p>

      <div class="map-card-slots">
        <span class="map-card-slots-label">Slots:</span>
        <span class="map-card-slots-list">{{ slotNames(map) }}</span>
      </div>

      <div v-if="groupCount(map) > 0" class="map-card-groups">
        <span class="map-card-groups-label">Grupos:</span>
        <div class="map-card-group-tags">
          <span v-for="g in getGroups(map)" :key="g" class="group-tag">{{ g }}</span>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.maps-page {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.map-card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-lg);
}

.map-card-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.map-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: #fff;
  font-size: 16px;
  flex-shrink: 0;
}

.map-card-title-area {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.map-card-name {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text-primary);
}

.map-card-meta {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.map-card-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.map-card-slots,
.map-card-groups {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.map-card-slots-label,
.map-card-groups-label {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.map-card-slots-list {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.map-card-group-tags {
  display: flex;
  gap: var(--spacing-xs);
}

.group-tag {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-accent);
  background: var(--color-border);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
}
</style>
