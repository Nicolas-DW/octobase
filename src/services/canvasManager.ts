/**
 * Service de gestion de multiples toiles
 * Gère la création, suppression, tri et persistance de plusieurs toiles
 */

import { loadCanvasState, type CanvasViewState } from './storage'

export interface CanvasData {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  viewState: CanvasViewState
  elements: {
    shapes?: any[]
    [key: string]: any
  }
}

const CANVASES_STORAGE_KEY = 'octobase-canvases'
const CURRENT_CANVAS_ID_KEY = 'octobase-current-canvas-id'

export type SortOption = 'name' | 'nameDesc' | 'createdAt'

/**
 * Récupère toutes les toiles sauvegardées
 */
export function getAllCanvases(): CanvasData[] {
  try {
    const serialized = localStorage.getItem(CANVASES_STORAGE_KEY)
    if (!serialized) {
      return []
    }
    return JSON.parse(serialized)
  } catch (error) {
    console.error('Erreur lors du chargement des toiles:', error)
    return []
  }
}

/**
 * Sauvegarde toutes les toiles
 */
function saveAllCanvases(canvases: CanvasData[]): void {
  try {
    const serialized = JSON.stringify(canvases)
    localStorage.setItem(CANVASES_STORAGE_KEY, serialized)
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des toiles:', error)
  }
}

/**
 * Récupère l'ID de la toile actuellement sélectionnée
 */
export function getCurrentCanvasId(): string | null {
  try {
    return localStorage.getItem(CURRENT_CANVAS_ID_KEY)
  } catch (error) {
    console.error('Erreur lors de la récupération de la toile courante:', error)
    return null
  }
}

/**
 * Définit l'ID de la toile actuellement sélectionnée
 */
export function setCurrentCanvasId(canvasId: string | null): void {
  try {
    if (canvasId) {
      localStorage.setItem(CURRENT_CANVAS_ID_KEY, canvasId)
    } else {
      localStorage.removeItem(CURRENT_CANVAS_ID_KEY)
    }
  } catch (error) {
    console.error('Erreur lors de la définition de la toile courante:', error)
  }
}

/**
 * Récupère une toile par son ID
 */
export function getCanvasById(id: string): CanvasData | null {
  const canvases = getAllCanvases()
  return canvases.find(canvas => canvas.id === id) || null
}

/**
 * Récupère la toile actuellement sélectionnée
 */
export function getCurrentCanvas(): CanvasData | null {
  const currentId = getCurrentCanvasId()
  if (!currentId) {
    return null
  }
  return getCanvasById(currentId)
}

/**
 * Crée une nouvelle toile
 */
export function createCanvas(name?: string): CanvasData {
  const canvases = getAllCanvases()
  const now = Date.now()
  const newCanvas: CanvasData = {
    id: `canvas-${now}-${Math.random().toString(36).substr(2, 9)}`,
    name: name || `Toile ${canvases.length + 1}`,
    createdAt: now,
    updatedAt: now,
    viewState: { x: 0, y: 0, zoom: 1 },
    elements: {
      shapes: []
    }
  }
  
  canvases.push(newCanvas)
  saveAllCanvases(canvases)
  setCurrentCanvasId(newCanvas.id)
  
  return newCanvas
}

/**
 * Met à jour une toile existante
 */
export function updateCanvas(
  id: string,
  updates: {
    name?: string
    viewState?: CanvasViewState
    shapes?: any[]
    additionalElements?: { [key: string]: any }
  }
): void {
  const canvases = getAllCanvases()
  const canvasIndex = canvases.findIndex(canvas => canvas.id === id)
  
  if (canvasIndex === -1) {
    console.warn(`Toile avec l'ID ${id} non trouvée`)
    return
  }
  
  const canvas = canvases[canvasIndex]
  canvases[canvasIndex] = {
    ...canvas,
    ...(updates.name && { name: updates.name }),
    ...(updates.viewState && { viewState: updates.viewState }),
    updatedAt: Date.now(),
    elements: {
      ...canvas.elements,
      ...(updates.shapes !== undefined && { shapes: updates.shapes }),
      ...updates.additionalElements
    }
  }
  
  saveAllCanvases(canvases)
}

/**
 * Supprime une toile
 */
export function deleteCanvas(id: string): void {
  const canvases = getAllCanvases()
  const filtered = canvases.filter(canvas => canvas.id !== id)
  saveAllCanvases(filtered)
  
  // Si la toile supprimée était la toile courante, sélectionner une autre ou null
  const currentId = getCurrentCanvasId()
  if (currentId === id) {
    if (filtered.length > 0) {
      // Sélectionner la première toile disponible
      setCurrentCanvasId(filtered[0].id)
    } else {
      // Aucune toile restante
      setCurrentCanvasId(null)
    }
  }
}

/**
 * Trie les toiles selon l'option donnée
 */
export function sortCanvases(canvases: CanvasData[], sortBy: SortOption): CanvasData[] {
  const sorted = [...canvases]
  
  if (sortBy === 'name') {
    // Tri A-Z
    sorted.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
  } else if (sortBy === 'nameDesc') {
    // Tri Z-A
    sorted.sort((a, b) => b.name.localeCompare(a.name, 'fr', { sensitivity: 'base' }))
  } else if (sortBy === 'createdAt') {
    // Tri par position d'origine (ordre de création)
    sorted.sort((a, b) => a.createdAt - b.createdAt)
  }
  
  return sorted
}

/**
 * Migre les données de l'ancien système (storage.ts) vers le nouveau système
 * Cette fonction est appelée une seule fois lors de la migration
 */
export function migrateOldCanvasData(): CanvasData | null {
  try {
    // Vérifier s'il y a des données dans l'ancien format
    const oldData = loadCanvasState()
    if (!oldData) {
      return null
    }
    
    // Vérifier si on a déjà migré (on vérifie si des toiles existent déjà)
    const existingCanvases = getAllCanvases()
    if (existingCanvases.length > 0) {
      // Migration déjà effectuée ou données déjà présentes
      return null
    }
    
    // Créer une nouvelle toile avec les données anciennes
    const now = Date.now()
    const migratedCanvas: CanvasData = {
      id: `canvas-${now}-migrated`,
      name: 'Toile migrée',
      createdAt: oldData.metadata?.lastSaved || now,
      updatedAt: oldData.metadata?.lastSaved || now,
      viewState: oldData.viewState,
      elements: oldData.elements
    }
    
    const canvases = [migratedCanvas]
    saveAllCanvases(canvases)
    setCurrentCanvasId(migratedCanvas.id)
    
    // Optionnel: supprimer les anciennes données (décommenter si souhaité)
    // localStorage.removeItem('octobase-canvas-state')
    
    return migratedCanvas
  } catch (error) {
    console.error('Erreur lors de la migration des données:', error)
    return null
  }
}

