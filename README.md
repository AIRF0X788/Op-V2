# 🌍 WorldConquest.io

Un jeu de stratégie multijoueur en temps réel inspiré d'OpenFront.io, où vous conquérez le monde avec vos amis !

## ✨ Fonctionnalités

- 🎮 **Multijoueur en temps réel** avec Socket.io
- 🤖 **Intelligence artificielle** pour les bots adverses
- 💰 **Système économique** avec gestion des ressources
- ⚔️ **Combat stratégique** entre territoires
- 🤝 **Système d'alliances** (à venir)
- 🏆 **Classement en temps réel** des joueurs
- 🎨 **Interface moderne** et responsive

## 📁 Structure du Projet

```
worldconquest-io/
├── client/
│   ├── index.html          # Page principale
│   ├── css/
│   │   └── style.css       # Styles du jeu
│   └── js/
│       ├── main.js         # Point d'entrée
│       ├── game.js         # Logique principale
│       ├── renderer.js     # Rendu graphique
│       ├── ui.js           # Gestion UI
│       └── network.js      # Communication Socket.io
├── server/
│   └── server.js           # Serveur Node.js
├── package.json
└── README.md
```

## 🚀 Installation Locale

### Prérequis
- Node.js (v14 ou supérieur)
- npm ou yarn

### Étapes

1. **Cloner ou créer le projet**
```bash
mkdir worldconquest-io
cd worldconquest-io
```

2. **Créer la structure des dossiers**
```bash
mkdir -p client/css client/js server
```

3. **Copier les fichiers** fournis dans leurs dossiers respectifs

4. **Installer les dépendances**
```bash
npm install
```

5. **Lancer le serveur en mode développement**
```bash
npm run dev
```

6. **Ouvrir votre navigateur**
```
http://localhost:3000
```

## 🌐 Hébergement Gratuit

### Option 1 : Render.com (Recommandé)

1. Créer un compte sur [Render.com](https://render.com)
2. Créer un nouveau **Web Service**
3. Connecter votre dépôt GitHub
4. Configuration :
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Environment** : Node
5. Déployer !

### Option 2 : Railway.app

1. Créer un compte sur [Railway.app](https://railway.app)
2. Créer un nouveau projet depuis GitHub
3. Railway détecte automatiquement Node.js
4. Déploiement automatique !

### Option 3 : Glitch.com

1. Créer un compte sur [Glitch.com](https://glitch.com)
2. Créer un nouveau projet Node.js
3. Importer vos fichiers ou cloner depuis GitHub
4. Le serveur démarre automatiquement

### Option 4 : Heroku

1. Créer un compte sur [Heroku](https://heroku.com)
2. Installer Heroku CLI
```bash
heroku login
heroku create worldconquest-io
git push heroku main
```

## 🎮 Comment Jouer

### Créer une Partie

1. Entrez votre pseudo
2. Cliquez sur "Créer une partie"
3. Partagez le code de la room avec vos amis
4. Attendez que tout le monde rejoigne
5. Cliquez sur "Démarrer la partie"

### Mécaniques de Jeu

#### 💰 Économie
- Chaque territoire génère de l'or automatiquement
- L'or est nécessaire pour recruter des troupes
- Plus vous avez de territoires, plus vos revenus sont élevés

#### ⚔️ Combat
- Sélectionnez un de vos territoires
- Choisissez un territoire voisin à attaquer
- Envoyez vos troupes
- L'attaquant a un bonus de 20% au combat

#### 🤖 Bots
- Les bots jouent automatiquement
- Ils attaquent les territoires faibles
- Parfait pour s'entraîner au début

#### 🏆 Victoire
- Conquérez tous les territoires de la carte
- Éliminez tous vos adversaires
- Devenez le maître du monde !

## 🔧 Configuration Avancée

### Variables d'Environnement

Créer un fichier `.env` :
```env
PORT=3000
NODE_ENV=production
```

### Modifier les Paramètres du Jeu

Dans `server/server.js`, vous pouvez ajuster :

```javascript
// Nombre de bots par défaut
this.initializeBots(5); // Changer le nombre ici

// Vitesse du jeu (en millisecondes)
this.tickRate = 1000; // 1 seconde par tick

// Or de départ
gold: 1000, // Pour les joueurs
gold: 500,  // Pour les bots
```

### Ajouter des Territoires

Dans la méthode `initializeTerritories()` :

```javascript
const territoryData = [
  { 
    id: 'nouveau', 
    name: 'Nouveau Territoire', 
    x: 500, 
    y: 300, 
    income: 100, 
    troops: 50 
  },
];
```

## 🐛 Résolution de Problèmes

### Le serveur ne démarre pas
```bash
# Vérifier que le port 3000 est libre
lsof -i :3000

# Utiliser un autre port
PORT=8080 npm start
```

### Les joueurs ne se connectent pas
- Vérifiez que le serveur est accessible
- Vérifiez les règles de pare-feu
- En production, utilisez HTTPS

### Lag ou latence
- Réduire le `tickRate` dans le serveur
- Optimiser le nombre de bots
- Vérifier la connexion réseau

## 🔐 Sécurité

Pour une version production, ajoutez :

1. **Rate limiting**
```bash
npm install express-rate-limit
```

2. **Validation des entrées**
```bash
npm install express-validator
```

3. **CORS configuré**
```javascript
const cors = require('cors');
app.use(cors({ origin: 'https://votredomaine.com' }));
```

## 📈 Améliorations Futures

- [ ] Système d'alliances fonctionnel
- [ ] Commerce entre joueurs
- [ ] Technologie et upgrades
- [ ] Carte du monde plus détaillée
- [ ] Système de classement global
- [ ] Chat en jeu
- [ ] Modes de jeu alternatifs

Bon jeu ! 🎮🌍