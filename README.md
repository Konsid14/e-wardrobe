E-Wardrobe

Simple client-side e-wardrobe prototype. Users can create accounts (stored in browser localStorage), upload a profile photo and clothes images, place clothes over the profile photo and save outfit history. Each cloth records a size.

Build as APK (overview):

1. Locally with Capacitor + Android Studio
   - Install Node and npm
   - npm install -g @capacitor/cli
   - In project folder: npm init -y (already present), npm install @capacitor/core
   - npx cap init
   - npx cap add android
   - npx cap copy
   - Open Android project in Android Studio and build an APK

2. Using GitHub Actions
   - A sample workflow is included to build an Android debug APK using Gradle and a preinstalled JDK on ubuntu-latest runners. You will still need to sign the APK before publishing.

Security and limitations:
- This is a demo: authentication and storage are client-only (localStorage). For production, move to a backend with proper authentication, storage, and image processing.
- Overlay placement is manual and approximate. For automatic cloth fitting to a person's body, integrate ML (pose estimation / segmentation) server-side or use TensorFlow.js models.

Files:
- index.html - main UI
- styles.css - styles
- app.js - main logic
- capacitor.config.json - Capacitor config
- package.json - metadata
- .github/workflows/android-build.yml - sample CI to build an APK
