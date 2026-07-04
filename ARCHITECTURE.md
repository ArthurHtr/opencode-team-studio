# Architecture

```text
React Flow et formulaires structurés
              │
              ▼
        TeamSnapshot typé
              │
              ▼
     PUT /api/team/apply
              │
        ┌─────┴─────┐
        ▼           ▼
Backup complet   Génération OpenCode
  backups-config/...  agents/*.md + opencode.jsonc
        │           │
        └──── rollback automatique en cas d'échec

┌─────────────────────────────────────────────────────┐
│ Multi-Team Profiles (nouveau)                        │
│                                                      │
│ studio-data/teams.json  ← registre des équipes       │
│ studio-data/teams/<id>/ ← profil complet d'une équipe│
│   ├── manifest.json                                   │
│   ├── opencode.json(c)                               │
│   ├── agents/                                        │
│   ├── layout.json                                    │
│   ├── metadata.json                                  │
│   └── revisions/                                     │
│                                                      │
│ Runtime actif (OPENCODE_CONFIG_DIR/)                 │
│   ├── opencode.json(c)  ← équipe active matérialisée │
│   ├── agents/         ← agents de l'équipe active    │
│   ├── skills/         ← partagées globalement        │
│   ├── commands/       ← partagées globalement        │
│   └── plugins/        ← partagées globalement        │
└─────────────────────────────────────────────────────┘
```

## Principe

- le graphe est un brouillon local ;
- les relations sont compilées en permissions OpenCode ;
- le layout React Flow est séparé de la configuration OpenCode ;
- les propriétés inconnues des agents et de la configuration sont conservées ;
- les modifications de ressources et de configuration globale utilisent le même mécanisme de backup transactionnel ;
- chaque équipe a son propre profil complet (config, agents, layout, metadata) ;
- le runtime expose toujours exactement une équipe active aux chemins standards OpenCode ;
- les ressources globales (skills, commands, plugins, secrets) restent partagées.

## Activation transactionnelle

1. Vérifier que l'équipe cible existe et n'est pas déjà active
2. Synchroniser le runtime courant vers le profil de l'équipe sortante
3. Créer un backup technique (rollback)
4. Copier le profil cible vers un emplacement temporaire
5. Valider le contenu temporaire
6. Remplacer atomiquement config + agents/ du runtime
7. Re-lire le runtime et vérifier le snapshot
8. Mettre à jour activeTeamId dans le registre
9. En cas d'erreur : restaurer le backup technique

## Migration

- La migration s'exécute une seule fois au premier lancement
- Elle détecte opencode.json ou opencode.jsonc
- Elle crée une équipe "Default team" avec toutes les données existantes
- Elle est idempotente (ne recrée pas si le registre existe déjà)

## Révisions

- Chaque équipe conserve au maximum 3 révisions
- Les révisions sont dédupliquées par hash SHA-256
- Une restauration crée un backup technique puis restaure le profil
