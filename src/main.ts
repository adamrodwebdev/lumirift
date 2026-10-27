import { createApp } from 'vue';
import App from './App.vue';
import { APP_SERVICES, createBrowserServices } from './app/AppServices';
import { firstGameOf } from './app/firstGame';
import { createPlatform } from './platform/createPlatform';
import { createAppI18n } from './i18n';
import { preloadStage } from './ui/stages';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/stage.css';
import './styles/sheet.css';
import './styles/ambiances.css';

// The portal's SDK first (portal builds): it provides the language and the save.
const platform = await createPlatform();
document.documentElement.dataset.platform = platform.id;
const services = createBrowserServices(platform);

// The messages of the player's language only (fetched early by the page itself).
const i18n = await createAppI18n(services.settings.current.locale);

// A new player on a portal starts straight in a game (App.vue): its game,
// family and stage download now, behind the title card, never over a blank screen.
const firstGame = firstGameOf(platform, services.profile.needsTraining);
if (firstGame) {
  await Promise.all([
    import('./ui/screens/GameScreen.vue'),
    services.catalog.preload(firstGame.modeId),
    preloadStage(services.catalog.get(firstGame.modeId)),
  ]);
}
createApp(App).provide(APP_SERVICES, services).use(i18n).mount('#app');

// The game is on screen: the title card shown while it loaded dissolves.
const splash = document.getElementById('splash');
if (splash) {
  splash.classList.add('splash--out');
  setTimeout(() => splash.remove(), 400);
}

// The first screen is painted and interactive: the portal may stop its loading screen.
requestAnimationFrame(() => requestAnimationFrame(() => platform.ready()));
