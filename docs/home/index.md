# home

What the group's apps share. Code lives in `home/`; its docs live here.

## Projects

| Project | Status | Description |
|---------|--------|-------------|
| Bot | Deployed | The `Enbraile` Discord bot: one process on the owner's home cluster hosting each feature as a module, starting with the DJ, plus hearing, speech and Claude for modules: [explanation](bot/explanation/bot.md), [how to run and deploy it](bot/how-to/run-and-deploy-the-bot.md) |
| Voice | Runs on the owner's PC | The bot's ears and voice: Whisper and Piper on the owner's GPU, connected to the bot: [explanation](voice/explanation/voice.md), [how to run it](voice/how-to/run-the-voice-worker.md) |
| Site | Deployed | `enbraile.vip`: the Discord sign-in every app shares, then links to the apps: [explanation](site/explanation/site.md), [how to deploy it](site/how-to/deploy-the-site.md) |
