# 🌍 WorldConquest.io - Style OpenFront.io

Un jeu de stratégie multijoueur en temps réel où vous conquérez l'Europe pixel par pixel avec vos amis !

## ✨ Fonctionnalités

### 🎮 Gameplay Style OpenFront.io
- **Placement de base** : Choisissez stratégiquement où commencer sur la carte d'Europe
- **Expansion organique** : Étendez votre territoire cellule par cellule
- **Combat tactique** : Attaquez les territoires adjacents ennemis
- **Système économique** : Gagnez de l'or avec vos territoires et recrutez des troupes
- **Temps réel** : Jouez simultanément avec vos amis

### 🗺️ Carte
- Grille de 150x100 cellules représentant l'Europe
- Détection terre/mer automatique
- Minimap pour navigation rapide
- Zoom et déplacement fluides

### 🎯 Objectif
Conquérez **80% de la carte** pour remporter la victoire !

## 📁 Structure du Projet

```
worldconquest-io/
├── client/
│   ├── index.html              # Interface principale
│   ├── css/
│   │   └── style.css           # Styles du jeu
│   └── js/
│       ├── main.js             # Point d'entrée
│       ├── game.js             # Logique principale
│       ├── mapRenderer.js      # Rendu de la carte
│       ├── placement.js        # Phase de placement
│       ├── ui.js               # Interface utilisateur
│       └── network.js          # Communication Socket.io
├── server/
│   ├── server.js               # Serveur principal
│   ├── game/
│   │   ├── GameRoomOpenFront.js # Gestion des parties
│   │   ├── MapGrid.js          # Système de grille
│   │   ├── Player.js           # Classe joueur
│   │   ├── Bot.js              # Intelligence artificielle
│   │   └── Territory.js        # Ancien système (legacy)
│   └── utils/
│       └── helpers.js          # Fonctions utilitaires
├── package.json
└── README.md
```

## 🚀 Installation Locale

### Prérequis
- Node.js v14 ou supérieur
- npm ou yarn

### Installation

```bash
# 1. Créer le projet
mkdir worldconquest-io
cd worldconquest-io

# 2. Copier tous les fichiers dans leur dossier respectif

# 3. Installer les dépendances
npm install

# 4. Lancer le serveur
npm start

# Ou en mode développement avec auto-reload
npm run dev
```

### Ouvrir le jeu

```
http://localhost:3000
```

## 🎮 Comment Jouer

### 1️⃣ Créer ou Rejoindre une Partie

1. Entrez votre pseudo
2. Cliquez sur **"Créer une partie"** ou **"Rejoindre une partie"**
3. Si vous rejoignez, entrez le code à 6 caractères
4. Partagez le code avec vos amis

### 2️⃣ Placer Votre Base

1. Une fois tous les joueurs dans le lobby, l'hôte démarre la partie
2. **Cliquez sur une zone verte** de la carte pour placer votre base
3. Choisissez stratégiquement ! Vous ne pourrez pas changer
4. Attendez que tous les joueurs placent leur base

### 3️⃣ Conquérir l'Europe

**Contrôles :**
- **Clic gauche** : Sélectionner une cellule
- **Clic droit + drag** : Déplacer la caméra
- **Molette** : Zoomer/Dézoomer

**Actions disponibles :**

#### 🏠 Étendre votre territoire
- Coût : **50 💰**
- Cliquez sur une cellule adjacente à votre territoire
- Si elle est neutre, vous la prenez directement
- Si elle appartient à un ennemi, combat automatique !

#### ⚔️ Combat
- Le combat est **automatique** basé sur les troupes adjacentes
- Plus vous avez de troupes autour, plus vous avez de chances de gagner
- Les pertes sont distribuées sur vos cellules adjacentes

#### 🛡️ Renforcer vos cellules
- Coût : **10 💰 par troupe**
- Ajoutez des troupes à une cellule que vous possédez
- Défendez les positions stratégiques

#### 💰 Économie
- Chaque cellule génère **1 💰/seconde**
- Plus vous avez de territoire, plus vous gagnez d'or
- Utilisez votre or pour étendre et renforcer

### 4️⃣ Gagner la Partie

- Conquérez **80% de toutes les terres** de la carte
- Éliminez tous vos adversaires
- Devenez le maître de l'Europe ! 👑

## 🌐 Hébergement Gratuit

### Option 1 : Railway.app (Recommandé)

1. Créer un compte sur [Railway.app](https://railway.app)
2. Créer un nouveau projet depuis GitHub
3. Railway détecte automatiquement Node.js
4. Variables d'environnement (optionnel) :
   ```
   PORT=3000
   NODE_ENV=production
   ```
5. Déployer automatiquement !

**Avantages :**
- ✅ Déploiement automatique depuis GitHub
- ✅ 500 heures gratuites par mois
- ✅ WebSocket supporté
- ✅ HTTPS inclus

### Option 2 : Render.com

1. Créer un compte sur [Render.com](https://render.com)
2. Créer un nouveau **Web Service**
3. Configuration :
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Environment** : Node
4. Déployer !

### Option 3 : Glitch.com

1. Créer un compte sur [Glitch.com](https://glitch.com)
2. Créer un nouveau projet Node.js
3. Importer vos fichiers
4. Le serveur démarre automatiquement

## ⚙️ Configuration

### Modifier la taille de la carte

Dans `server/game/GameRoomOpenFront.js` :

```javascript
// Ligne 17
this.mapGrid = new MapGrid(150, 100); // Largeur x Hauteur
```

### Ajuster les coûts

Dans `server/game/GameRoomOpenFront.js` :

```javascript
// Coût d'expansion (ligne ~180)
const cost = 50; // Changer ici

// Coût de recrutement (dans reinforceCell)
const cost = troopCount * 10; // 10 or par troupe
```

### Modifier la condition de victoire

Dans `server/game/GameRoomOpenFront.js`, méthode `checkVictory()` :

```javascript
// Ligne ~270
const victoryThreshold = totalLandCells * 0.8; // 80% -> changer ici
```

### Changer la vitesse du jeu

Dans `server/game/GameRoomOpenFront.js` :

```javascript
// Ligne 14
this.tickRate = 100; // En millisecondes (100 = 10 ticks/seconde)
```

## 🐛 Résolution de Problèmes

### Le serveur ne démarre pas

```bash
# Vérifier que Node.js est installé
node --version

# Réinstaller les dépendances
rm -rf node_modules package-lock.json
npm install

# Vérifier que le port est libre
lsof -i :3000
```

### Les joueurs ne se connectent pas

- Vérifiez que le serveur est accessible
- En local, utilisez `localhost:3000`
- En production, vérifiez les règles de pare-feu
- Assurez-vous que WebSocket est activé

### La carte ne s'affiche pas

- Ouvrez la console du navigateur (F12)
- Vérifiez les erreurs JavaScript
- Rafraîchissez la page (Ctrl+F5)

### Performance lente

- Réduisez la taille de la grille (ligne 17 de GameRoomOpenFront.js)
- Augmentez le tickRate (moins de mises à jour par seconde)
- Activez la compression dans server.js

## 🔧 Développement

### Ajouter des fonctionnalités

Le code est modulaire pour faciliter l'ajout de features :

- **Nouvelles actions** : Ajoutez des événements dans `server/server.js`
- **Nouveau rendu** : Modifiez `client/js/mapRenderer.js`
- **Nouvelle UI** : Éditez `client/js/ui.js`
- **Logique de jeu** : Changez `server/game/GameRoomOpenFront.js`

### Structure des événements Socket.io

**Client → Serveur :**
- `createRoom` - Créer une partie
- `joinRoom` - Rejoindre une partie
- `startGame` - Démarrer (phase placement)
- `placeBase` - Placer sa base
- `expandTerritory` - Étendre son territoire
- `reinforceCell` - Renforcer une cellule

**Serveur → Client :**
- `roomCreated` - Room créée
- `roomJoined` - Room rejointe
- `gameStarted` - Partie démarrée (placement)
- `phaseChanged` - Changement de phase
- `fullState` - État complet du jeu
- `gridUpdate` - Mise à jour (delta)
- `gameOver` - Fin de partie

## 📈 Améliorations Futures

- [ ] Véritable carte d'Europe (avec GeoJSON)
- [ ] Système d'alliances fonctionnel
- [ ] Chat en jeu
- [ ] Replays des parties
- [ ] Classement global
- [ ] Modes de jeu alternatifs (1v1, équipes, etc.)
- [ ] Technologies/upgrades
- [ ] Événements aléatoires
- [ ] IA des bots améliorée

🎮 Bon jeu ! Conquérez l'Europe ! 🌍

**Debug mode :** Tapez `debugGame()` dans la console du navigateur pour voir l'état du jeu.