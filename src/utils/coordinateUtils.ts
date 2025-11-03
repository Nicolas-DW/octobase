/**
 * Utilitaires pour la conversion de coordonnées entre l'écran et le monde
 * Garantit la synchronisation parfaite entre le fond canvas et les éléments DOM
 */

export interface ViewState {
  x: number
  y: number
  zoom: number
}

/**
 * Convertit les coordonnées écran (relatives au canvas) en coordonnées monde
 * Cette fonction est utilisée de manière cohérente pour garantir la synchronisation
 * entre le fond canvas et les éléments DOM
 * 
 * @param screenX - Coordonnée X relative au canvas (en pixels)
 * @param screenY - Coordonnée Y relative au canvas (en pixels)
 * @param viewState - État de la vue (translation et zoom)
 * @returns Coordonnées monde correspondantes
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  viewState: ViewState
): { x: number; y: number } {
  // Formule unifiée pour la conversion
  // Le canvas utilise setTransform(zoom, 0, 0, zoom, x, y)
  // Le DOM utilise translate(x, y) scale(zoom)
  // Les deux sont équivalents, cette formule garantit la cohérence
  return {
    x: (screenX - viewState.x) / viewState.zoom,
    y: (screenY - viewState.y) / viewState.zoom,
  }
}

/**
 * Convertit les coordonnées monde en coordonnées écran (relatives au canvas)
 * 
 * @param worldX - Coordonnée X en monde
 * @param worldY - Coordonnée Y en monde
 * @param viewState - État de la vue (translation et zoom)
 * @returns Coordonnées écran correspondantes
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  viewState: ViewState
): { x: number; y: number } {
  return {
    x: worldX * viewState.zoom + viewState.x,
    y: worldY * viewState.zoom + viewState.y,
  }
}

/**
 * Convertit les coordonnées client (relatives à la fenêtre) en coordonnées monde
 * Utile pour les événements de souris/touch
 * 
 * IMPORTANT: Cette fonction utilise getBoundingClientRect() pour obtenir la position réelle
 * du canvas dans la fenêtre. Cela garantit que le système fonctionne correctement :
 * - Avec la sidebar ouverte ou fermée
 * - Avec différentes tailles de sidebar (responsive)
 * - Avec n'importe quelle position du canvas dans la fenêtre
 * 
 * @param clientX - Coordonnée X relative à la fenêtre (en pixels)
 * @param clientY - Coordonnée Y relative à la fenêtre (en pixels)
 * @param canvasRect - Rectangle de positionnement du canvas (getBoundingClientRect())
 * @param viewState - État de la vue (translation et zoom)
 * @returns Coordonnées monde correspondantes
 */
export function clientToWorld(
  clientX: number,
  clientY: number,
  canvasRect: DOMRect,
  viewState: ViewState
): { x: number; y: number } {
  // Convertir d'abord en coordonnées écran (relatives au canvas)
  // La soustraction de canvasRect.left/top tient compte de la position réelle du canvas
  // (par exemple, décalé par la sidebar ou toute autre raison)
  const screenX = clientX - canvasRect.left
  const screenY = clientY - canvasRect.top
  
  // Puis convertir en coordonnées monde
  return screenToWorld(screenX, screenY, viewState)
}

