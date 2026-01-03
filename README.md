# 🍽️ Famealy - Familienmenü Vorschläge

Eine moderne Web-Anwendung, die **ausgewogene** Menüvorschläge für Familien generiert, basierend auf **Aktionen Schweizer Detailhändler** (Migros, Coop, Denner, Aldi Suisse, Lidl Schweiz). Mit integrierter Rezeptsuche und Export zur Family Wall App.

## ✨ Features

### 🏷️ Schweizer Aktionen
- **Aktionsbasierte Vorschläge**: Bevorzugung von Gerichten mit Zutaten im Angebot
- **Top Schweizer Händler**: Migros, Coop, Denner, Aldi Suisse, Lidl Schweiz
- **Einsparungen sichtbar**: Klare Markierung von Aktionsprodukten

### 🥗 Ausgewogene Ernährung
- **Nährwert-Balance**: Priorisierung ausgewogener Mahlzeiten
- **Kalorienwerte**: Transparente Nährwertangaben
- **Vielfältige Küchen**: Schweizer Klassiker, Italienisch, Asiatisch, Mexikanisch, Vegan

### 📖 Rezeptsuche & Integration
- **Online Rezeptsuche**: Direktlinks zu Betty Bossi, Swissmilk, Fooby (Coop)
- **Family Wall Integration**: Export der Einkaufsliste zum Kopieren
- **Ein-Klick Export**: Zutaten direkt in die Zwischenablage

### 🎯 Weitere Features
- 👨‍👩‍👧‍👦 **Familiengrösse**: Anpassung an 1-12 Personen
- ⚠️ **Allergen-Filter**: Ausschluss von Gluten, Milch, Nüssen, etc.
- 📊 **Schwierigkeitsgrade**: Einfach bis mittel
- 🎨 **Modernes UI**: Responsive Swiss Design

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
Personalisierte Menüvorschläge generieren mit Aktions- und Balance-Priorisierung

**Request Body:**
```json
{
  "familySize": 4,
  "allergens": ["Gluten", "Nüsse"],
  "preferences": ["Schweizer Klassiker", "vegetarisch"],
  "difficulty": "einfach",
  "count": 3,
  "preferBalanced": true,
  "preferPromotions": true
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
      "ingredients": [
        {
          "name": "Spaghetti",
          "amount": "500g",
          "onPromo": true,
          "retailer": "Migros"
        }
      ],
      "allergens": ["Gluten"],
      "tags": ["familienfreundlich", "klassisch"],
      "nutrition": {
        "calories": 520,
        "protein": "high",
        "carbs": "high",
        "balanced": true
      }
    }
  ],
  "total": 10
}
```

### GET `/api/recipe/search?mealName=Spaghetti%20Bolognese`
Rezept-Suchlinks für Schweizer Rezeptseiten

**Response:**
```json
{
  "mealName": "Spaghetti Bolognese",
  "searchUrls": [
    {
      "name": "Betty Bossi",
      "url": "https://www.bettybossi.ch/de/Suche?q=Spaghetti+Bolognese"
    },
    {
      "name": "Swissmilk",
      "url": "https://www.swissmilk.ch/de/rezepte-kochideen/?q=Spaghetti+Bolognese"
    },
    {
      "name": "Fooby (Coop)",
      "url": "https://fooby.ch/de/rezepte.html?q=Spaghetti+Bolognese"
    }
  ]
}
```

### POST `/api/shopping-list/export`
Einkaufsliste exportieren (für Family Wall)

**Request Body:**
```json
{
  "ingredients": [...],
  "mealName": "Spaghetti Bolognese"
}
```

**Response:**
```json
{
  "mealName": "Spaghetti Bolognese",
  "textFormat": "Spaghetti - 500g\nRindshackfleisch - 400g\n...",
  "csvFormat": "Zutat,Menge,Aktion,Händler\n...",
  "count": 7
}
```

### GET `/api/categories`
Alle verfügbaren Kategorien

### GET `/api/allergens`
Alle Allergene in der Datenbank

## 🍴 Verfügbare Gerichte

Die App enthält 14 ausgewogene Gerichte mit Schweizer Aktionen:

- **Schweizer Klassiker**: Älplermagronen, Rindsgeschnetzeltes Züri-Art, Schweinsschnitzel mit Kartoffelsalat
- **Italienisch**: Spaghetti Bolognese, Pasta mit Basilikumpesto
- **Asiatisch**: Pouletcurry mit Basmatireis, Linsen-Dal mit Naan
- **Mexikanisch**: Chili con Carne, Poulet-Tacos
- **Vegetarisch**: Gemüselasagne, Gemüse-Quiche
- **Vegan**: Gemüsepfanne mit Tofu, Linsen-Dal mit Naan
- **Fisch**: Lachsfilet mit Ofengemüse
- **Suppen**: Minestrone mit Vollkornbrot

Jedes Gericht enthält:
- Detaillierte Zutatenliste mit Mengenangaben
- Aktions-Markierung von Schweizer Händlern
- Nährwertinformationen und Balance-Bewertung
- Allergen-Informationen

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

### Vorschläge generieren
1. **Familiengrösse eingeben**: Anzahl der Personen (1-12)
2. **Optionen aktivieren**:
   - ✓ Ausgewogene Mahlzeiten bevorzugen
   - ✓ Aktionen von Schweizer Detailhändlern bevorzugen
3. **Allergene ausschliessen**: Klicken Sie auf Allergene (Gluten, Milch, Nüsse, etc.)
4. **Präferenzen wählen**: Bevorzugte Kategorien auswählen
5. **Schwierigkeitsgrad**: Optional filtern nach einfach/mittel
6. **Vorschläge generieren**: Klick auf "🎲 Vorschläge generieren"

### Rezept finden
1. **Gericht auswählen**: Aus den generierten Vorschlägen
2. **"📖 Rezept suchen"** klicken
3. **Rezeptlinks öffnen**: Betty Bossi, Swissmilk, Fooby oder Google

### Einkaufsliste exportieren
1. **"🛒 Einkaufsliste kopieren"** klicken
2. **Family Wall öffnen**: Mobile App starten
3. **Zur Einkaufsliste navigieren**
4. **Zutaten einfügen**: Aus der Zwischenablage (Strg+V / Cmd+V)

Die kopierten Zutaten sind formatiert als:
```
Spaghetti - 500g
Rindshackfleisch - 400g
Tomaten passiert - 400g
...
```

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
