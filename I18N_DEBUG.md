# Guide de débogage i18n

## Problème : La détection de langue ne fonctionne pas

### Causes possibles :
1. **LocalStorage contient une ancienne valeur** : La clé `i18nextLng` dans le localStorage peut bloquer la détection
2. **Cookies** : Des cookies peuvent interférer avec la détection
3. **Configuration incorrecte** : Mauvais mapping des langues

## Solutions appliquées :

### 1. Configuration corrigée (src/i18n/index.ts)
- ✅ Ajout d'alias pour toutes les variantes de langue (pt-BR, pt, en-US, en, etc.)
- ✅ Fonction `convertDetectedLanguage` pour normaliser les codes de langue
- ✅ Ordre de détection : `navigator` → `localStorage` → `htmlTag` → `cookie`
- ✅ Debug mode activé (`debug: true`) pour voir les logs dans la console

### 2. Comment tester la détection

#### Option A : Nettoyer le localStorage (RECOMMANDÉ)
1. Ouvrir la console du navigateur (F12)
2. Aller dans l'onglet **Console**
3. Exécuter cette commande :
   ```javascript
   localStorage.removeItem('i18nextLng');
   location.reload();
   ```

#### Option B : Tester avec différentes langues
1. Ouvrir la console du navigateur (F12)
2. Vérifier les logs i18next (si debug: true)
3. Changer la langue du navigateur dans les paramètres
4. Nettoyer le localStorage avec la commande ci-dessus
5. Recharger la page

#### Option C : Tester manuellement dans la console
```javascript
// Voir la langue actuelle
console.log(navigator.language);

// Voir la langue détectée par i18next
console.log(localStorage.getItem('i18nextLng'));

// Forcer une langue
localStorage.setItem('i18nextLng', 'en');
location.reload();
```

### 3. Vérifier la console du navigateur

Avec `debug: true`, vous devriez voir des logs comme :
```
i18next: languageChanged pt-BR
i18next: initialized {...}
```

### 4. Langues supportées

| Code navigateur | Langue chargée | Fichier utilisé |
|-----------------|----------------|-----------------|
| pt-BR, pt       | pt-BR          | pt-BR.json      |
| en-US, en-GB, en| en             | en.json         |
| es-ES, es-MX, es| es             | es.json         |
| fr-FR, fr-CA, fr| fr             | fr.json         |

## Étapes de test après le fix :

1. **Nettoyer le localStorage**
   ```javascript
   localStorage.clear();
   location.reload();
   ```

2. **Vérifier la langue du navigateur**
   - Ouvrir DevTools (F12)
   - Console → Taper `navigator.language`
   - Devrait afficher votre langue (ex: "fr-FR", "en-US", "pt-BR")

3. **Recharger la page**
   - Le site devrait s'afficher dans la langue du navigateur
   - Vérifier les logs i18next dans la console

4. **Tester le LanguageSwitcher**
   - Changer la langue via le sélecteur
   - Vérifier que la langue change
   - Recharger → la langue choisie doit être conservée

## En cas de problème persistant :

### Vérifier que i18next est bien initialisé
```javascript
// Dans la console du navigateur
import('./src/i18n/index.ts').then(i18n => console.log(i18n.default.language));
```

### Désactiver temporairement le cache localStorage
Modifier `src/i18n/index.ts` ligne 36 :
```typescript
caches: [], // Désactive le cache temporairement
```

Puis tester si la détection fonctionne sans cache.
