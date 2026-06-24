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
 backups/...      agents/*.md + opencode.jsonc
        │           │
        └──── rollback automatique en cas d’échec
```

## Principe

- le graphe est un brouillon local ;
- les relations sont compilées en permissions OpenCode ;
- le layout React Flow est séparé de la configuration OpenCode ;
- les propriétés inconnues des agents et de la configuration sont conservées ;
- les modifications de ressources et de configuration globale utilisent le même mécanisme de backup transactionnel.
