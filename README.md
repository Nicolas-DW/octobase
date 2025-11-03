# Octobase

**Octobase** est une application de canvas infini moderne et puissante, inspirée de [Heptabase](https://heptabase.com/) et [Excalidraw](https://excalidraw.com/). Elle permet de créer, organiser et visualiser des contenus dans un espace infini avec une navigation fluide et intuitive.

## 📋 Table des matières

- [Fonctionnalités](#-fonctionnalités)
- [Installation](#-installation)
- [Utilisation](#-utilisation)
- [Architecture et fonctionnement](#-architecture-et-fonctionnement)
- [Exemples d'utilisation](#-exemples-dutilisation)
- [Structure du projet](#-structure-du-projet)
- [Développement](#-développement)

---

## ✨ Fonctionnalités

### Formes et éléments
- **Formes géométriques** : Carrés, cercles, triangles avec couleurs personnalisées
- **Blocs de texte** : Support complet du Markdown pour la mise en forme
- **Sélection multiple** : Sélectionner et déplacer plusieurs éléments simultanément
- **Couleurs aléatoires** : Les formes sont créées avec des couleurs HSL aléatoires

### Navigation et vue
- **Canvas infini** : Espace de travail illimité dans toutes les directions
- **Zoom et pan** : Navigation fluide avec la souris, le trackpad ou le clavier
- **Fonds personnalisables** : 6 types de fonds différents (grille, radar, points, diagonales, quadrillé, isométrique)
- **Recentrage automatique** : Bouton "Home" pour recentrer la vue sur toutes les formes

### Gestion des toiles
- **Multiples toiles** : Créer et gérer plusieurs canevas indépendants
- **Sauvegarde automatique** : Toutes les modifications sont sauvegardées automatiquement dans le navigateur
- **Export/Import** : Exporter vos toiles en JSON et les importer sur d'autres machines
- **Tri et organisation** : Tri par nom (A-Z, Z-A) ou par date de création

### Interactions
- **Menu contextuel** : Clic droit pour ajouter des formes à une position précise
- **Édition de texte** : Double-clic pour éditer les blocs de texte avec support Markdown
- **Modes de sélection** : Mode pan (déplacement) et mode sélection avec rectangle de sélection
- **Raccourcis clavier** : Espace pour passer temporairement en mode sélection

---

## 🚀 Installation

### Prérequis
- Node.js (version 18 ou supérieure)
- npm ou yarn

### Étapes d'installation

1. **Cloner le dépôt** (si vous avez accès au dépôt)
   ```bash
   git clone <url-du-depot>
   cd Octobase
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Lancer le serveur de développement**
   ```bash
   npm run dev
   ```

4. **Ouvrir dans le navigateur**
   L'application sera accessible à l'adresse affichée (généralement `http://localhost:5173`)

### Build de production

Pour créer une version de production optimisée :

```bash
npm run build
```

Les fichiers compilés seront dans le dossier `dist/`. Vous pouvez les servir avec n'importe quel serveur web statique.

---

## 📖 Utilisation

### Premiers pas

1. **Créer une nouvelle toile**
   - Cliquez sur le bouton "+" dans la sidebar pour créer une nouvelle toile
   - Donnez-lui un nom ou acceptez le nom par défaut

2. **Ajouter des formes**
   - Cliquez sur le bouton "+" au centre de l'écran
   - Choisissez parmi : Carré, Cercle, Triangle, ou Bloc de texte
   - La forme apparaîtra au centre de votre vue actuelle

3. **Naviguer dans l'espace**
   - **Pan** : Cliquez et glissez avec le bouton gauche de la souris
   - **Zoom** : Utilisez la molette de la souris (Ctrl/Cmd + molette) ou pincez sur trackpad
   - **Pan avec trackpad** : Utilisez deux doigts pour faire défiler
   - **Zoom avec trackpad** : Pincez avec deux doigts

4. **Déplacer des formes**
   - Cliquez sur une forme et glissez-la pour la déplacer
   - Sélectionnez plusieurs formes (mode sélection) et déplacez-les ensemble

### Guide détaillé

#### Mode Pan (déplacement)
- **Par défaut**, vous êtes en mode pan
- Cliquez et glissez pour déplacer la vue
- Cliquez sur une forme pour la déplacer directement
- Maintenez **Espace** pour passer temporairement en mode sélection

#### Mode Sélection
- Cliquez sur le bouton "Sélection" dans les contrôles du canvas
- Cliquez et glissez pour créer un rectangle de sélection
- Toutes les formes intersectées seront sélectionnées
- Déplacez les formes sélectionnées ensemble

#### Ajouter des formes

**Méthode 1 : Bouton central**
1. Cliquez sur le bouton "+" au centre de l'écran
2. Choisissez le type de forme
3. La forme apparaît au centre de votre vue

**Méthode 2 : Menu contextuel**
1. Faites un clic droit n'importe où sur le canvas
2. Choisissez le type de forme
3. La forme apparaît à la position du clic

#### Éditer du texte

1. **Créer un bloc de texte** : Ajoutez un bloc de texte depuis le menu
2. **Éditer** : Double-cliquez sur le bloc de texte
3. **Formatage Markdown** : Utilisez la syntaxe Markdown dans l'éditeur :
   ```markdown
   # Titre principal
   ## Sous-titre
   
   Texte en **gras** ou en *italique*
   
   - Liste à puces
   - Item 2
   
   1. Liste numérotée
   2. Item 2
   ```
4. **Sauvegarder** : 
   - Appuyez sur **Ctrl/Cmd + Enter**
   - Ou cliquez en dehors du bloc
5. **Annuler** : Appuyez sur **Escape**

#### Changer le fond

1. Cliquez sur le bouton de fond (icône de grille) en bas à droite
2. Choisissez parmi les options :
   - **Grille normale** : Grille classique
   - **Grille radar** : Grille avec axes centraux marqués
   - **Points** : Fond avec des points
   - **Diagonales** : Lignes diagonales
   - **Quadrillé** : Papier quadrillé style graphique
   - **Isométrique** : Grille isométrique pour dessins 3D

#### Gérer les toiles

**Créer une toile**
- Cliquez sur le bouton "+" dans la sidebar
- Entrez un nom ou appuyez sur Entrée pour un nom par défaut

**Sélectionner une toile**
- Cliquez sur une toile dans la liste de la sidebar

**Supprimer une toile**
- Cliquez sur l'icône de corbeille à droite du nom de la toile
- Confirmez la suppression

**Trier les toiles**
- Utilisez les boutons de tri dans la sidebar :
  - **A-Z** : Tri alphabétique croissant
  - **Z-A** : Tri alphabétique décroissant
  - **Horloge** : Tri par date de création

**Exporter une toile**
1. Sélectionnez la toile à exporter
2. Cliquez sur "Exporter" dans la sidebar
3. Un fichier JSON sera téléchargé

**Importer une toile**
1. Cliquez sur "Importer" dans la sidebar
2. Sélectionnez un fichier JSON exporté précédemment
3. Une nouvelle toile sera créée avec les données importées

#### Recentrer la vue

- Cliquez sur le bouton "Home" (icône de maison) en bas à gauche
- La vue se recentrera automatiquement sur toutes les formes
- Si aucune forme n'existe, la vue se recentre sur l'origine (0,0)

---

## 🏗️ Architecture et fonctionnement

### Vue d'ensemble

Octobase est construit avec **React** et **TypeScript**, utilisant **Vite** comme outil de build. L'application utilise une architecture hybride combinant :
- **Canvas HTML5** pour le rendu du fond (performances optimisées)
- **DOM** pour les éléments interactifs (formes et texte)
- **localStorage** pour la persistance des données

### Système de coordonnées

L'application utilise un système de coordonnées à deux niveaux :

#### Coordonnées Monde
- Coordonnées absolues dans l'espace infini du canvas
- Les formes sont positionnées en coordonnées monde
- L'origine (0,0) est au centre conceptuel du canvas

#### Coordonnées Écran
- Coordonnées relatives à la fenêtre du navigateur
- Utilisées pour les interactions utilisateur (clic, souris)
- Converties en coordonnées monde via des fonctions utilitaires

#### Conversion des coordonnées

Le fichier `src/utils/coordinateUtils.ts` contient les fonctions de conversion :

```typescript
// Convertir coordonnées écran → monde
screenToWorld(screenX, screenY, viewState)

// Convertir coordonnées monde → écran
worldToScreen(worldX, worldY, viewState)

// Convertir coordonnées client (fenêtre) → monde
clientToWorld(clientX, clientY, canvasRect, viewState)
```

**Exemple de transformation** :
```typescript
// Coordonnées monde (0, 0) avec zoom 2x et translation (100, 100)
// → Coordonnées écran (100, 100)

// Coordonnées écran (200, 200) avec zoom 2x et translation (100, 100)
// → Coordonnées monde (50, 50)
```

### Gestion de l'état de la vue

La vue est gérée par un objet `ViewState` :

```typescript
interface ViewState {
  x: number      // Translation horizontale (pixels)
  y: number      // Translation verticale (pixels)
  zoom: number   // Facteur de zoom (1.0 = 100%)
}
```

**Transformations appliquées** :
- Le canvas utilise `setTransform(zoom, 0, 0, zoom, x, y)`
- Le conteneur DOM utilise `translate(x, y) scale(zoom)`
- Les deux sont équivalents mathématiquement pour garantir la synchronisation

### Système de sauvegarde

#### Structure des données

Chaque toile (`CanvasData`) contient :

```typescript
{
  id: string                    // Identifiant unique
  name: string                  // Nom de la toile
  createdAt: number            // Timestamp de création
  updatedAt: number            // Timestamp de dernière modification
  viewState: {                 // État de la vue
    x: number
    y: number
    zoom: number
  }
  backgroundType: string       // Type de fond ('grid', 'radar', etc.)
  elements: {                  // Éléments de la toile
    shapes: Shape[]            // Tableau de formes
  }
}
```

#### Sauvegarde automatique

La sauvegarde est déclenchée automatiquement avec un **debounce** de 500ms pour :
- Les changements de formes (ajout, déplacement, modification)
- Les changements de vue (zoom, pan)
- Les changements de type de fond

**Avantages** :
- Évite trop de sauvegardes pendant les interactions
- Performance optimisée
- Données toujours à jour

#### Stockage

Les données sont stockées dans `localStorage` avec les clés :
- `octobase-canvases` : Liste de toutes les toiles
- `octobase-current-canvas-id` : ID de la toile actuellement active

### Rendu hybride Canvas + DOM

#### Fond (Canvas)
- Rendu avec un `<canvas>` HTML5
- Redessiné à chaque changement de vue ou de type de fond
- Transformations appliquées via `setTransform()`
- Performance optimale pour les grilles complexes

#### Éléments (DOM)
- Formes géométriques : Composants React (`ShapeBlock`)
- Blocs de texte : Composants React (`TextBlock`)
- Positionnés avec `transform: translate()` dans un conteneur transformé
- Interactions natives du navigateur (hover, click, etc.)

**Synchronisation** :
Les transformations Canvas et DOM utilisent exactement les mêmes formules mathématiques pour garantir que les éléments sont parfaitement alignés avec le fond.

### Gestion des événements

#### Souris
- **Clic gauche** : Déplacer forme ou pan
- **Clic milieu** : Pan uniquement
- **Clic droit** : Menu contextuel
- **Molette** : Zoom (avec Ctrl/Cmd) ou pan (sans Ctrl/Cmd)
- **Double-clic** : Éditer bloc de texte

#### Clavier
- **Espace** : Mode sélection temporaire (maintenir)
- **Ctrl/Cmd + Enter** : Sauvegarder édition de texte
- **Escape** : Annuler édition de texte

#### Trackpad
- **Deux doigts** : Pan
- **Pincement** : Zoom
- **Détection automatique** : L'application détecte les gestes multi-touch

### Détection de collision

Le système utilise des algorithmes spécifiques pour chaque type de forme :

#### Carré / Rectangle / Texte
```typescript
pointInShape = 
  worldX >= shape.x &&
  worldX <= shape.x + shape.width &&
  worldY >= shape.y &&
  worldY <= shape.y + shape.height
```

#### Cercle
```typescript
centerX = shape.x + shape.width / 2
centerY = shape.y + shape.height / 2
radius = Math.min(shape.width, shape.height) / 2
distance = Math.sqrt((worldX - centerX)² + (worldY - centerY)²)
pointInShape = distance <= radius
```

#### Triangle
```typescript
// Utilise les coordonnées barycentriques
// Calcule si le point est à l'intérieur du triangle formé par les 3 sommets
```

### Mode sélection multiple

1. **Activation** : Bouton "Sélection" ou touche Espace
2. **Rectangle de sélection** : Cliquez et glissez pour créer un rectangle
3. **Détection d'intersection** : Algorithmes spécifiques pour chaque type de forme
4. **Déplacement groupé** : Toutes les formes sélectionnées bougent ensemble
5. **Stockage des positions initiales** : Pour éviter l'accumulation d'erreurs lors du déplacement

---

## 💡 Exemples d'utilisation

### Exemple 1 : Créer un diagramme simple

1. **Créer une nouvelle toile** nommée "Mon diagramme"
2. **Ajouter des formes** :
   - Un carré pour "Étape 1"
   - Un cercle pour "Étape 2"
   - Un triangle pour "Étape 3"
3. **Ajouter des blocs de texte** :
   - Double-cliquez sur chaque bloc pour ajouter du texte
   - Utilisez Markdown pour la mise en forme
4. **Organiser** :
   - Déplacez les formes pour créer un flux
   - Utilisez la sélection multiple pour aligner des éléments
5. **Changer le fond** : Choisissez "Quadrillé" pour un style plus professionnel

### Exemple 2 : Prendre des notes avec Markdown

1. **Créer un bloc de texte** au centre
2. **Éditer avec Markdown** :
   ```markdown
   # Mes Notes
   
   ## Réunion du 15/01
   
   - Point 1 : Discussion
   - Point 2 : Décisions
   - Point 3 : Actions
   
   **Important** : Suivre le projet X
   ```
3. **Ajouter d'autres blocs** pour organiser vos notes
4. **Utiliser différents fonds** selon le contexte (isométrique pour des schémas 3D)

### Exemple 3 : Exporter et partager

1. **Créer votre toile** avec vos formes et texte
2. **Exporter** : Cliquez sur "Exporter" dans la sidebar
3. **Partager le fichier JSON** avec un collègue
4. **Import** : Votre collègue peut importer le fichier dans son instance d'Octobase

### Exemple 4 : Organiser plusieurs projets

1. **Créer plusieurs toiles** :
   - "Projet A - Planning"
   - "Projet B - Architecture"
   - "Notes personnelles"
2. **Trier** par nom pour retrouver rapidement une toile
3. **Basculer** entre les toiles via la sidebar

### Exemple 5 : Workflow avancé

1. **Mode Sélection** : Activez le mode sélection
2. **Sélection multiple** : Créez un rectangle de sélection autour de plusieurs formes
3. **Déplacer ensemble** : Toutes les formes sélectionnées se déplacent simultanément
4. **Dupliquer visuellement** : Exportez, importez, puis modifiez pour créer des variations

---

## 📁 Structure du projet

```
Octobase/
├── src/
│   ├── components/
│   │   ├── Canvas.tsx          # Composant principal du canvas
│   │   ├── Canvas.css          # Styles du canvas
│   │   ├── ShapeBlock.tsx      # Composant pour les formes géométriques
│   │   ├── ShapeBlock.css      # Styles des formes
│   │   ├── TextBlock.tsx       # Composant pour les blocs de texte
│   │   ├── TextBlock.css       # Styles des blocs de texte
│   │   ├── Sidebar.tsx         # Sidebar de gestion des toiles
│   │   └── Sidebar.css         # Styles de la sidebar
│   ├── services/
│   │   ├── canvasManager.ts    # Gestion des toiles (CRUD)
│   │   └── storage.ts          # Service de sauvegarde (legacy)
│   ├── utils/
│   │   └── coordinateUtils.ts  # Utilitaires de conversion de coordonnées
│   ├── App.tsx                 # Composant racine de l'application
│   ├── App.css                 # Styles globaux
│   ├── main.tsx                # Point d'entrée de l'application
│   └── index.css               # Styles de base
├── dist/                       # Build de production (généré)
├── package.json                # Dépendances et scripts
├── tsconfig.json               # Configuration TypeScript
├── vite.config.ts              # Configuration Vite
└── README.md                   # Ce fichier
```

### Description des fichiers principaux

#### `App.tsx`
- Composant racine de l'application
- Gère l'état global (formes, toile courante, vue)
- Coordonne les interactions entre les composants
- Gère la sauvegarde automatique

#### `Canvas.tsx`
- Composant principal du canvas
- Gère le rendu du fond (Canvas HTML5)
- Gère les interactions (souris, clavier, trackpad)
- Gère la navigation (zoom, pan)
- Gère la sélection et le déplacement des formes

#### `canvasManager.ts`
- Service de gestion des toiles
- CRUD complet (Create, Read, Update, Delete)
- Tri et organisation des toiles
- Migration depuis l'ancien format de sauvegarde

#### `coordinateUtils.ts`
- Fonctions de conversion de coordonnées
- Garantit la synchronisation entre Canvas et DOM
- Gère les transformations de vue

---

## 🔧 Développement

### Technologies utilisées

- **React 18** : Bibliothèque UI
- **TypeScript** : Typage statique
- **Vite** : Build tool et dev server
- **react-markdown** : Rendu Markdown dans les blocs de texte

### Scripts disponibles

```bash
# Développement
npm run dev          # Lance le serveur de développement

# Build
npm run build        # Compile pour la production

# Preview
npm run preview      # Prévisualise le build de production
```

### Structure des données

#### Shape (Forme)
```typescript
interface Shape {
  id: string
  type: 'square' | 'circle' | 'triangle' | 'text'
  x: number
  y: number
  width: number
  height: number
  color: string
  content?: string  // Pour les blocs de texte (Markdown)
}
```

#### CanvasData (Toile)
```typescript
interface CanvasData {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  viewState: CanvasViewState
  backgroundType?: BackgroundType
  elements: {
    shapes?: Shape[]
    [key: string]: any
  }
}
```

### Points d'extension

Le système est conçu pour être extensible :

1. **Nouveaux types de formes** :
   - Ajouter dans `Shape['type']`
   - Créer un composant dans `components/`
   - Ajouter la logique de rendu dans `Canvas.tsx`

2. **Nouveaux types d'éléments** :
   - Ajouter dans `CanvasData.elements`
   - Étendre le système de sauvegarde dans `canvasManager.ts`

3. **Nouveaux types de fonds** :
   - Ajouter dans `BackgroundType`
   - Implémenter le rendu dans `Canvas.tsx` (fonction `drawBackground`)

### Debugging

Les données sont stockées dans `localStorage`. Pour inspecter :

1. Ouvrez les DevTools (F12)
2. Onglet "Application" → "Local Storage"
3. Cherchez les clés `octobase-canvases` et `octobase-current-canvas-id`

### Performance

- **Debounce de sauvegarde** : 500ms pour éviter trop d'écritures
- **Debounce de notifications de vue** : 300ms
- **Canvas pour le fond** : Performances optimales pour les grilles
- **DOM pour les éléments** : Interactions natives et accessibilité

---

## 🎯 Fonctionnalités futures possibles

- [ ] Support des images
- [ ] Groupes d'éléments
- [ ] Connexions/liens entre éléments
- [ ] Support des calques
- [ ] Annulation/Refaire (Undo/Redo)
- [ ] Collaboration en temps réel
- [ ] Thèmes personnalisables
- [ ] Export en PNG/PDF
- [ ] Support tactile amélioré (tablettes)

---

## 📝 Notes techniques

### Synchronisation Canvas/DOM

La synchronisation parfaite entre le fond Canvas et les éléments DOM est garantie par :
1. Utilisation des mêmes formules de transformation
2. Fonctions utilitaires centralisées pour les conversions
3. Tests visuels : Les éléments doivent toujours être alignés avec la grille

### Gestion des erreurs

- Toutes les opérations de sauvegarde sont dans des try/catch
- Les erreurs sont loggées dans la console
- L'application continue de fonctionner même en cas d'erreur de sauvegarde

### Compatibilité navigateur

- Chrome/Edge : ✅ Pleinement supporté
- Firefox : ✅ Pleinement supporté
- Safari : ✅ Pleinement supporté (avec gestes trackpad)
- Mobile : ⚠️ Support partiel (améliorations prévues)

---

## 📄 Licence

Ce projet est sous licence MIT.

---

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
- Ouvrir des issues pour signaler des bugs
- Proposer de nouvelles fonctionnalités
- Soumettre des pull requests

---

**Octobase** - Créez, organisez et visualisez dans un espace infini. 🚀
