/* Production switches and content. Relics and shops stay deliberately unavailable. */
A4.CardRules.install(A4.catalog);
A4.TreasureRules.install(A4.catalog);
A4.BossRules.install(A4.catalog);
A4.Classes.install(A4.catalog);
A4.Expansion.install(A4.catalog);
A4.GuffRules.install(A4.catalog);
A4.catalog.config.engineVersion=3;
A4.catalog.config.enabled=true;
A4.catalog.config.rooms={live:['옥랜111','옥랜222'],test:['개발123']};
A4.catalog.config.initialInventory={gold:0,keys:5,stones:0,essence:0};
A4.catalog.config.sessionTimeoutMs=60000;
A4.catalog.config.relicsEnabled=false;
A4.catalog.config.shopEnabled=false;
