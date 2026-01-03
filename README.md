# 🍽️ Famealy - Familienmenü Vorschläge

Eine moderne Web-Anwendung, die personalisierte Menüvorschläge für Familien generiert. Berücksichtigt Familiengröße, Allergene, Präferenzen und Schwierigkeitsgrad.

## ✨ Features

- 🎲 **Intelligente Vorschläge**: Automatische Menüvorschläge basierend auf Ihren Präferenzen
- 👨‍👩‍👧‍👦 **Familienfreundlich**: Anpassung an Familiengröße (1-12 Personen)
- ⚠️ **Allergen-Filter**: Ausschluss von Gerichten mit bestimmten Allergenen
- 🌍 **Vielfältige Küchen**: Italienisch, Deutsch, Asiatisch, Mexikanisch, Vegan und mehr
- 📊 **Schwierigkeitsgrade**: Wählen Sie zwischen einfach, mittel oder allen Gerichten
- 🎨 **Modernes UI**: Responsive Design mit ansprechendem Interface

## 🚀 Schnellstart

### Mit Docker (empfohlen)

```bash
# Repository klonen
git clone <repository-url>
cd famealy

# Mit Docker Compose starten
docker-compose up -d

# App öffnen
# Browser: http://localhost:3001
```

### Lokale Entwicklung

**Voraussetzungen:**
- Node.js 18+
- npm

**Installation:**

```bash
# Abhängigkeiten installieren
npm install
cd client && npm install && cd ..

# Entwicklungsserver starten
npm run dev

# Backend läuft auf: http://localhost:3001
# Frontend läuft auf: http://localhost:3000
```

**Nur Backend:**
```bash
npm run server
```

**Nur Frontend:**
```bash
npm run client
```

**Production Build:**
```bash
# Frontend bauen
npm run build

# Production Server starten
NODE_ENV=production npm start
```

## 📁 Projektstruktur

```
famealy/
├── client/                 # React Frontend
│   ├── public/
│   ├── src/
│   │   ├── App.js         # Hauptkomponente
│   │   ├── App.css        # Styling
│   │   └── index.js       # Entry Point
│   └── package.json
├── server/                # Express Backend
│   ├── data/
│   │   └── meals.json     # Mahlzeiten-Datenbank
│   └── index.js           # API Server
├── Dockerfile             # Docker Build
├── docker-compose.yml     # Docker Orchestrierung
└── package.json           # Root Dependencies
```

## 🔌 API Endpunkte

### GET `/api/meals`
Alle verfügbaren Mahlzeiten abrufen

### POST `/api/suggestions`
Personalisierte Menüvorschläge generieren

**Request Body:**
```json
{
  "familySize": 4,
  "allergens": ["Gluten", "Nüsse"],
  "preferences": ["Italienisch", "vegetarisch"],
  "difficulty": "einfach",
  "count": 3
}
```

**Response:**
```json
{
  "suggestions": [
    {
      "id": 1,
      "name": "Spaghetti Bolognese",
      "category": "Italienisch",
      "prepTime": 30,
      "difficulty": "einfach",
      "servings": 4,
      "ingredients": [...],
      "allergens": ["Gluten"],
      "tags": ["familienfreundlich", "klassisch"]
    }
  ],
  "total": 10
}
```

### GET `/api/categories`
Alle verfügbaren Kategorien

### GET `/api/allergens`
Alle Allergene in der Datenbank

## 🍴 Verfügbare Gerichte

Die App enthält 12 vorbereitete Gerichte:

- **Italienisch**: Spaghetti Bolognese, Pizza Margherita, Pasta mit Pesto
- **Deutsch**: Schnitzel mit Kartoffelsalat, Rindergeschnetzeltes mit Spätzle
- **Asiatisch**: Hähnchencurry mit Reis, Gemüsepfanne mit Tofu
- **Mexikanisch**: Chili con Carne, Tacos mit Hähnchen
- **Vegetarisch/Vegan**: Gemüselasagne, Gemüsepfanne mit Tofu
- **Fisch**: Lachsfilet mit Ofengemüse
- **Suppen**: Gemüsesuppe mit Brot

## 🛠️ Technologie-Stack

**Frontend:**
- React 18
- Modern CSS (Flexbox, Grid)
- Responsive Design

**Backend:**
- Node.js
- Express.js
- JSON-basierte Datenspeicherung

**DevOps:**
- Docker & Docker Compose
- Multi-Stage Builds

## 🎯 Verwendung

1. **Familiengröße eingeben**: Anzahl der Personen (1-12)
2. **Allergene ausschließen**: Klicken Sie auf Allergene, die vermieden werden sollen
3. **Präferenzen wählen**: Wählen Sie bevorzugte Küchen oder Tags
4. **Schwierigkeitsgrad**: Optional filtern nach einfach/mittel
5. **Vorschläge generieren**: Klick auf den Button
6. **Ergebnis**: Personalisierte Menüvorschläge mit allen Details

## 📝 Eigene Gerichte hinzufügen

Bearbeiten Sie `server/data/meals.json`:

```json
{
  "id": 13,
  "name": "Ihr Gericht",
  "category": "Kategorie",
  "prepTime": 30,
  "difficulty": "einfach",
  "servings": 4,
  "ingredients": ["Zutat 1", "Zutat 2"],
  "allergens": ["Gluten"],
  "tags": ["familienfreundlich"]
}
```

## 🤝 Beitragen

Contributions sind willkommen!

1. Fork das Projekt
2. Feature Branch erstellen (`git checkout -b feature/NeuesFeature`)
3. Änderungen committen (`git commit -m 'Neues Feature hinzugefügt'`)
4. Branch pushen (`git push origin feature/NeuesFeature`)
5. Pull Request öffnen

## 📄 Lizenz

MIT License

## 🙏 Danksagungen

Erstellt mit ❤️ für Familien, die leckere und abwechslungsreiche Mahlzeiten genießen möchten.

---

**Viel Spaß beim Kochen! 👨‍🍳👩‍🍳**
