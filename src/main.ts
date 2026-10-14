import { createApp } from 'vue';
import App from './App.vue';
import { APP_SERVICES, createBrowserServices } from './app/AppServices';
import { createPlatform } from './platform/createPlatform';
import { createAppI18n } from './i18n';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ambiances.css';

// The portal's SDK first (portal builds): it provides the language and the save.
const platform = await createPlatform();
document.documentElement.dataset.platform = platform.id;
const services = createBrowserServices(platform);

createApp(App)
  .provide(APP_SERVICES, services)
  .use(createAppI18n(services.settings.current.locale))
  .mount('#app');

// The first screen is painted and interactive: the portal may stop its loading screen.
requestAnimationFrame(() => requestAnimationFrame(() => platform.ready()));
