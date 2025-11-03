/**
 * Service de sauvegarde et restauration de l'état de la toile
 * Structure extensible pour supporter de futurs éléments
 * 
 * Pour ajouter de nouveaux types d'éléments à la sauvegarde :
 * 1. Ajouter le type dans SavedCanvasState.elements (ex: texts?: TextElement[])
 * 2. Passer les nouveaux éléments à saveCanvasState via additionalElements
 * 3. Dans App.tsx, restaurer les nouveaux éléments depuis savedState.elements
 * 4. Si la structure change significativement, incrémenter SAVE_VERSION
 *    et ajouter une logique de migration dans loadCanvasState
 */

// Version du format de sauvegarde (à incrémenter si la structure change)
const SAVE_VERSION = 1

const STORAGE_KEY = 'octobase-canvas-state'

export interface CanvasViewState {
  x: number
  y: number
  zoom: number
}

export interface SavedCanvasState {
  version: number
  viewState: CanvasViewState
  elements: {
    shapes?: any[] // Utiliser any pour flexibilité avec futurs types
    // Ajouter ici d'autres types d'éléments futurs :
    // texts?: TextElement[]
    // images?: ImageElement[]
    // groups?: GroupElement[]
    // etc.
    [key: string]: any // Permet d'ajouter dynamiquement de nouveaux types
  }
  metadata?: {
    lastSaved?: number
    [key: string]: any // Métadonnées extensibles
  }
}

/**
 * Sauvegarde l'état actuel de la toile dans localStorage
 */
export function saveCanvasState(
  viewState: CanvasViewState,
  shapes: any[],
  additionalElements?: { [key: string]: any }
): void {
  try {
    const state: SavedCanvasState = {
      version: SAVE_VERSION,
      viewState,
      elements: {
        shapes: shapes || [],
        ...additionalElements, // Permet d'ajouter d'autres éléments facilement
      },
      metadata: {
        lastSaved: Date.now(),
      },
    }

    const serialized = JSON.stringify(state)
    localStorage.setItem(STORAGE_KEY, serialized)
  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error)
  }
}

/**
 * Charge l'état sauvegardé depuis localStorage
 */
export function loadCanvasState(): SavedCanvasState | null {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY)
    if (!serialized) {
      return null
    }

    const state: SavedCanvasState = JSON.parse(serialized)

    // Vérifier la version et migrer si nécessaire
    if (state.version !== SAVE_VERSION) {
      console.warn(
        `Version de sauvegarde différente (${state.version} vs ${SAVE_VERSION}). Migration non implémentée.`
      )
      // Ici, on pourrait ajouter une logique de migration si nécessaire
    }

    return state
  } catch (error) {
    console.error('Erreur lors du chargement:', error)
    return null
  }
}

/**
 * Efface la sauvegarde
 */
export function clearCanvasState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('Erreur lors de la suppression:', error)
  }
}

/**
 * Vérifie si une sauvegarde existe
 */
export function hasCanvasState(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null
}

