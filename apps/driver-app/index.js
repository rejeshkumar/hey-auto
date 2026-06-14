import { registerRootComponent } from 'expo';
import * as SplashScreen from 'expo-splash-screen';
import App from './src/app/App';

// Keep the native splash visible while JS loads.
// hideAsync() is called inside App's useEffect once the app is ready.
SplashScreen.preventAutoHideAsync();

registerRootComponent(App);
